// Eval runner (CLAUDE.md §9). Dependency-free: calls the DEPLOYED `ask` Edge Function with
// Node's built-in fetch and checks each fixture's answer/provenance against hand-verified
// expectations. Run on every change to the system prompt, tools, or schema.
//
//   npm run eval                 # all fixtures
//   npm run eval -- --only chassis   # filter by id/category substring
//   npm run eval -- --verbose        # print each answer

import { FIXTURES, type Check, type Fixture } from "./fixtures.ts";

const FN_URL = process.env.VITE_ASK_FUNCTION_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
if (!FN_URL || !ANON) {
  console.error("Missing VITE_ASK_FUNCTION_URL / VITE_SUPABASE_ANON_KEY (run via --env-file=.env)");
  process.exit(1);
}

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1]?.toLowerCase() : null;

type AskResponse = {
  answer?: string; error?: string;
  sources?: string[]; narrative_hits?: { failure_mode?: string | null }[];
};

async function ask(question: string): Promise<AskResponse> {
  const res = await fetch(FN_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON! },
    body: JSON.stringify({ question, history: [] }),
  });
  try { return (await res.json()) as AskResponse; }
  catch { return { error: `HTTP ${res.status}` }; }
}

// Strip thousands separators so "302,658" matches 302658.
const normNumbers = (s: string) => s.replace(/(?<=\d),(?=\d)/g, "");

function evalCheck(c: Check, r: AskResponse): string | null {
  const answer = r.answer ?? "";
  const lower = answer.toLowerCase();
  switch (c.kind) {
    case "number": {
      const hay = normNumbers(answer);
      const re = new RegExp(`(?<![\\d.,])${c.value}(?![\\d.,])`);
      if (!re.test(hay)) return `expected number ${c.value} not found in answer`;
      for (const m of c.mention ?? []) if (!lower.includes(m.toLowerCase())) return `missing mention "${m}"`;
      return null;
    }
    case "mention": {
      for (const m of c.all ?? []) if (!lower.includes(m.toLowerCase())) return `missing required "${m}"`;
      if (c.any && !c.any.some((m) => lower.includes(m.toLowerCase()))) return `none of [${c.any.join(", ")}] present`;
      for (const m of c.none ?? []) if (lower.includes(m.toLowerCase())) return `must not mention "${m}"`;
      return null;
    }
    case "narratives": {
      const hits = r.narrative_hits ?? [];
      if (hits.length < c.min) return `expected >=${c.min} narrative hits, got ${hits.length}`;
      if (c.failureMode) {
        const hasMode = hits.some((h) => (h.failure_mode ?? "").toLowerCase() === c.failureMode!.toLowerCase());
        if (!hasMode && !lower.includes(c.failureMode.toLowerCase())) return `no hit with failure_mode "${c.failureMode}"`;
      }
      return null;
    }
    case "sourcesAny": {
      const src = r.sources ?? [];
      if (!c.ids.some((id) => src.some((s) => s.endsWith(id)))) return `none of expected source ids present`;
      return null;
    }
  }
}

type Result = { fx: Fixture; ok: boolean; reasons: string[]; answer: string };

async function runOne(fx: Fixture): Promise<Result> {
  const r = await ask(fx.question);
  if (r.error) return { fx, ok: false, reasons: [`agent error: ${r.error}`], answer: "" };
  const reasons = fx.checks.map((c) => evalCheck(c, r)).filter((x): x is string => x !== null);
  return { fx, ok: reasons.length === 0, reasons, answer: r.answer ?? "" };
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

async function main() {
  const selected = FIXTURES.filter((f) => !only || f.id.toLowerCase().includes(only) || f.category.includes(only));
  console.log(`Running ${selected.length} eval${selected.length === 1 ? "" : "s"} against ${FN_URL}\n`);

  const results = await pool(selected, 3, runOne);

  let passed = 0;
  for (const res of results) {
    const tag = res.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
    console.log(`${tag}  [${res.fx.category}] ${res.fx.id}`);
    if (!res.ok) for (const r of res.reasons) console.log(`        ↳ ${r}`);
    if (verbose) console.log(`        answer: ${res.answer.replace(/\s+/g, " ").slice(0, 240)}…`);
    if (res.ok) passed++;
  }

  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} passed${failed ? `, \x1b[31m${failed} failed\x1b[0m` : ""}`);
  // Set exitCode (don't call process.exit) so Node drains fetch sockets and reports cleanly.
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
