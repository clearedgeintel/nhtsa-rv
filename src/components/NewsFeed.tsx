import { useEffect, useState } from "react";
import { getRvNews } from "../api";
import type { NewsItem } from "../types";

/** Shared fetch for both the News tab and the sidebar card (server caches ~30 min). */
function useRvNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getRvNews().then((r) => {
      setItems(r.items);
      setFetchedAt(r.fetched_at);
      setLoading(false);
    });
  };
  useEffect(load, []);
  return { items, fetchedAt, loading, reload: load };
}

/** Compact relative time, e.g. "3h ago" / "2d ago". */
function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
}

/** Full news list for the "News" tab. */
export function NewsFeed() {
  const { items, fetchedAt, loading, reload } = useRvNews();

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">RV industry news</h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Latest headlines from RVBusiness, RV Travel, and Google News. Opens the source in a new tab.
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500"
        >
          ↻ Refresh
        </button>
      </div>

      {loading && items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">Loading headlines…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No headlines available right now. Try Refresh.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((it) => (
            <li
              key={it.link}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-emerald-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800 dark:hover:border-emerald-700"
            >
              <a href={it.link} target="_blank" rel="noreferrer" className="group block">
                <div className="text-[15px] font-semibold leading-snug text-slate-800 group-hover:text-emerald-700 dark:text-slate-100 dark:group-hover:text-emerald-300">
                  {it.title}
                </div>
                {it.summary && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">{it.summary}</p>
                )}
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium dark:bg-slate-700">{it.source}</span>
                  <span>{timeAgo(it.published)}</span>
                  <span aria-hidden className="ml-auto text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-slate-500">↗</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}

      {fetchedAt && (
        <p className="mt-4 text-[11px] text-slate-400">
          Updated {timeAgo(fetchedAt)} · headlines link to third-party sources; not affiliated with NHTSA.
        </p>
      )}
    </div>
  );
}

/** Compact "Latest RV news" card for the persistent sidebar. */
export function NewsCard({ onSeeAll }: { onSeeAll: () => void }) {
  const { items, loading } = useRvNews();

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Latest RV news</h3>
        <button onClick={onSeeAll} className="text-[10px] font-medium text-emerald-700 hover:underline dark:text-emerald-400">
          See all
        </button>
      </div>
      {loading && items.length === 0 ? (
        <p className="text-xs text-slate-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400">No news.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((it) => (
            <li key={it.link}>
              <a href={it.link} target="_blank" rel="noreferrer" className="group block">
                <div className="line-clamp-2 text-[11px] font-medium leading-snug text-slate-700 group-hover:text-emerald-700 dark:text-slate-200 dark:group-hover:text-emerald-300">
                  {it.title}
                </div>
                <div className="text-[10px] text-slate-400">
                  {it.source} · {timeAgo(it.published)}
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
