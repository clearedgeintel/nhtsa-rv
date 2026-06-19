// supabase/functions/rv-news — server-side RV news aggregator.
// The browser can't fetch third-party RSS directly (CORS), so this function fetches a
// curated set of RV-industry feeds, parses RSS 2.0 + Atom without any dependency, merges
// + dedupes + sorts by date, caches in-memory ~30 min, and returns JSON to the page.
//   GET  →  { items: NewsItem[], fetched_at }

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Curated general RV-industry feeds. `source` is the fallback label when a feed item
// doesn't carry its own <source> (Google News items do; the WordPress feeds don't).
const FEEDS: { url: string; source: string }[] = [
  {
    url:
      "https://news.google.com/rss/search?q=" +
      encodeURIComponent('RV OR motorhome OR "travel trailer" OR "recreational vehicle" recall OR industry') +
      "&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
  },
  { url: "https://rvbusiness.com/feed/", source: "RVBusiness" },
  { url: "https://www.rvtravel.com/feed/", source: "RV Travel" },
];

type NewsItem = { title: string; link: string; source: string; published: string | null; summary: string };

const MAX_ITEMS = 40;
const TTL_MS = 30 * 60 * 1000;
let cache: { at: number; items: NewsItem[] } | null = null;

const decodeEntities = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

// Decode first (unwraps CDATA + entity-encoded HTML like &lt;a&gt;), THEN strip tags.
const stripTags = (s: string) =>
  decodeEntities(decodeEntities(s).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** Inner text of the first <tag>…</tag> in a block. */
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}
/** An attribute value off the first <tag …attr="…">. */
function tagAttr(block: string, name: string, attr: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*\\b${attr}="([^"]*)"`, "i"));
  return m ? m[1] : "";
}

function parseFeed(xml: string, fallbackSource: string): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  for (const b of blocks) {
    const title = stripTags(tag(b, "title"));
    if (!title) continue;
    // RSS uses <link>text</link>; Atom uses <link href="…"/>.
    let link = stripTags(tag(b, "link"));
    if (!link) link = tagAttr(b, "link", "href");
    const published =
      tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date") || "";
    let summary = stripTags(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 240);
    // Google News items carry their own <source>, and suffix the title with " - Source".
    const feedSrc = stripTags(tag(b, "source"));
    const source = feedSrc || fallbackSource;
    const cleanTitle = feedSrc && title.endsWith(` - ${feedSrc}`) ? title.slice(0, -(feedSrc.length + 3)) : title;
    // Google News summaries are just the headline as a link — drop when they duplicate the title.
    if (summary.startsWith(cleanTitle.slice(0, 40)) || summary.includes(" - " + source)) summary = "";
    out.push({
      title: cleanTitle,
      link,
      source,
      published: published ? new Date(published).toISOString() : null,
      summary,
    });
  }
  return out;
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "RV-Defect-Intel/1.0" } });
    if (!res.ok) return [];
    return parseFeed(await res.text(), source);
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

async function aggregate(): Promise<NewsItem[]> {
  const lists = await Promise.all(FEEDS.map((f) => fetchFeed(f.url, f.source)));
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of lists.flat()) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  merged.sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
  return merged.slice(0, MAX_ITEMS);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "GET") return json({ error: "Use GET" }, 405);

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return json({ items: cache.items, fetched_at: new Date(cache.at).toISOString(), cached: true });
  }
  try {
    const items = await aggregate();
    if (items.length) cache = { at: now, items };
    return json({ items, fetched_at: new Date(now).toISOString() });
  } catch (e) {
    if (cache) return json({ items: cache.items, fetched_at: new Date(cache.at).toISOString(), stale: true });
    return json({ error: String((e as Error)?.message ?? e), items: [] }, 502);
  }
});
