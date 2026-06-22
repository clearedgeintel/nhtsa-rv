import { useEffect, useMemo, useRef, useState } from "react";
import { askAgentStream, groundingOf, getDataStatus } from "./api";
import type { ChatMessage, DataStatus } from "./types";
import { AssistantMessage } from "./components/AssistantMessage";
import { ReportView } from "./components/ReportView";
import { TaxonomyBrowser } from "./components/TaxonomyBrowser";
import { Sidebar } from "./components/Sidebar";
import { NewsFeed } from "./components/NewsFeed";
import { AuthModal } from "./components/AuthModal";
import { useAuthUser, signOut } from "./lib/auth";

// Larger pools per category so the Shuffle button surfaces fresh prompts each time.
const EXAMPLE_GROUPS = [
  {
    label: "Recalls",
    items: [
      "How many recalls involve Winnebago, including chassis?",
      "How many recall campaigns affect Grand Design 2024 models?",
      "What are the most recent Thor Motor Coach recalls?",
      "Which RV components are recalled most often?",
      "How many Jayco recalls were issued in 2023?",
      "Show recalls for Airstream travel trailers",
      "Which makes had the most affected units recalled?",
      "What chassis recalls affect Class A motorhomes?",
    ],
  },
  {
    label: "Complaints",
    items: [
      "Which RV makes have the most fire-related complaints?",
      "How many critical-severity complaints does Forest River have?",
      "What are the top complaint failure modes for Coachmen?",
      "Which makes have the most slide-out complaints?",
      "How many brake complaints involve Newmar?",
      "What components drive the most severe complaints?",
      "Which RV brands have the most electrical complaints?",
      "How many complaints mention propane or LP gas?",
    ],
  },
  {
    label: "Trends & comparisons",
    items: [
      "Show Keystone recall campaigns by model year",
      "Compare total recalls between Winnebago and Grand Design",
      "How have RV recalls trended over the last 5 years?",
      "Compare complaint counts for Thor vs Forest River",
      "Show fire-related complaints by year",
      "Which make has the worst recall-to-complaint ratio?",
      "Compare Class A and Class C motorhome recalls",
      "Show Jayco complaints by failure mode",
    ],
  },
  {
    label: "Describe an issue",
    items: [
      "Complaints describing sudden brake loss going downhill",
      "Reports of water intrusion or roof leaks",
      "Narratives about tires blowing out at highway speed",
      "Complaints describing slide-outs that won't retract",
      "Reports of refrigerators catching fire",
      "Narratives about awnings failing in wind",
      "Complaints describing steering or handling problems",
      "Reports of carbon monoxide or gas smell inside the coach",
    ],
  },
];

/** Pick n random items from a pool (Fisher-Yates-ish shuffle, good enough for prompts). */
function pickRandom<T>(arr: readonly T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [vin, setVin] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<DataStatus | null>(null);
  const [report, setReport] = useState<ChatMessage | null>(null);
  const [view, setView] = useState<"ask" | "explore" | "news">(() => {
    const v = new URLSearchParams(window.location.search).get("view");
    return v === "explore" || v === "news" ? v : "ask";
  });
  const [shuffle, setShuffle] = useState(0);
  // Two random prompts per category; re-rolled whenever the shuffle counter ticks.
  const examples = useMemo(
    () => EXAMPLE_GROUPS.map((g) => ({ label: g.label, items: pickRandom(g.items, 2) })),
    [shuffle],
  );
  const [dark, setDark] = useState(
    () =>
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const user = useAuthUser();
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    getDataStatus().then(setStatus);
  }, []);

  // Keep the ?view= param in sync with the active tab. Leaving Explore strips its
  // share params (make/year/mode/detail) so they don't leak onto Ask/News URLs.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const EXPLORE_KEYS = ["make", "myf", "myt", "rf", "rt", "mode", "detail"];
    if (view === "ask") {
      ["view", ...EXPLORE_KEYS].forEach((k) => p.delete(k));
    } else {
      p.set("view", view);
      if (view === "news") EXPLORE_KEYS.forEach((k) => p.delete(k));
    }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [view]);

  // Print a report to PDF: force light mode for the print, then restore.
  useEffect(() => {
    if (!report) return;
    const wasDark = document.documentElement.classList.contains("dark");
    if (wasDark) document.documentElement.classList.remove("dark");
    const restore = () => {
      if (wasDark) document.documentElement.classList.add("dark");
      setReport(null);
    };
    const t = setTimeout(() => window.print(), 350); // let charts paint first
    window.addEventListener("afterprint", restore, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", restore);
    };
  }, [report]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    const history = messages;
    setMessages((m) => [
      ...m,
      { role: "user", content: q },
      { role: "assistant", content: "", question: q, streaming: true, status: "Thinking…" },
    ]);
    setInput("");
    setLoading(true);

    // Update the most recent assistant message in place as the stream arrives.
    const setLast = (fn: (msg: ChatMessage) => ChatMessage) =>
      setMessages((m) => {
        const c = [...m];
        for (let i = c.length - 1; i >= 0; i--) {
          if (c[i].role === "assistant") {
            c[i] = fn(c[i]);
            break;
          }
        }
        return c;
      });

    await askAgentStream(q, history, {
      onText: (d) => setLast((msg) => ({ ...msg, content: msg.content + d, status: undefined })),
      onStatus: (label) => setLast((msg) => ({ ...msg, status: label })),
      onDone: (r) =>
        setLast((msg) => ({
          ...msg,
          content: r.answer || msg.content,
          sources: r.sources,
          sql_used: r.sql_used,
          narrative_hits: r.narrative_hits,
          charts: r.charts,
          followups: r.followups,
          grounding: groundingOf(r),
          streaming: false,
          status: undefined,
        })),
      onError: (e) =>
        setLast((msg) => ({ ...msg, content: `⚠️ ${e}`, isError: true, streaming: false, status: undefined })),
    });
    setLoading(false);
  }

  // Sidebar items jump into the Ask view with a scoped question.
  const askFromSidebar = (q: string) => {
    setView("ask");
    send(q);
  };

  // Deep-link from a chat answer into the Explore tab, pre-selecting a failure mode.
  const openInExplore = (mode: string) => {
    const p = new URLSearchParams(window.location.search);
    ["make", "myf", "myt", "rf", "rt", "detail"].forEach((k) => p.delete(k));
    p.set("view", "explore");
    p.set("mode", mode);
    window.history.replaceState(null, "", `?${p.toString()}`);
    setView("explore");
  };

  // Prefill the composer with an editable comparison template, then focus it.
  const startComparison = () => {
    setInput("Compare total recalls and the top complaint categories for Winnebago vs Grand Design, 2020–2025");
    setView("ask");
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const empty = messages.length === 0;

  return (
    <>
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 print:hidden">
      {/* Hero header */}
      <header className="relative shrink-0 overflow-hidden">
        <img
          src="/img/rv-1536.webp"
          srcSet="/img/rv-768.webp 768w, /img/rv-1536.webp 1536w"
          sizes="100vw"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/40" />
        <div className="relative mx-auto flex w-full max-w-4xl items-start justify-between px-4 py-6 sm:px-6 [text-shadow:0_1px_3px_rgb(0_0_0_/_70%)]">
          <div className="flex items-start gap-3 sm:gap-4">
            <img
              src="/img/logo-256.webp"
              alt="RV Defect Intelligence"
              width={64}
              height={64}
              decoding="async"
              className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-lg ring-2 ring-white/40 sm:h-16 sm:w-16 [text-shadow:none]"
            />
          <div>
            <span className="rounded-md bg-emerald-500/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/40 [text-shadow:none]">
              NHTSA · RV
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">RV Defect Intelligence</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-100">
              Ask plain-English questions about RV recalls, complaints, investigations, and TSBs —
              every number is traceable to its source.
            </p>
            {status && (
              <p className="mt-1.5 text-xs text-slate-300">
                NHTSA data refreshed{" "}
                {new Date(status.refreshed_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {status.recalls.toLocaleString()} recalls · {status.complaints.toLocaleString()} complaints ·{" "}
                {status.makes} makes
              </p>
            )}
            <div className="mt-3 inline-flex rounded-lg bg-white/10 p-0.5 ring-1 ring-white/20 [text-shadow:none]">
              {(["ask", "explore", "news"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={
                    "rounded-md px-3 py-1 text-xs font-semibold capitalize transition " +
                    (view === v ? "bg-white text-slate-900" : "text-slate-200 hover:text-white")
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 [text-shadow:none]">
            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden max-w-[10rem] truncate text-xs text-slate-200 sm:inline" title={user.email ?? ""}>
                  {user.email}
                </span>
                <button
                  onClick={() => void signOut()}
                  className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white shadow-sm ring-1 ring-emerald-300/40 hover:bg-emerald-500"
              >
                Sign in
              </button>
            )}
            <button
              onClick={() => setDark((d) => !d)}
              className="rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label="Toggle dark mode"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar onAsk={askFromSidebar} onSeeNews={() => setView("news")} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

      {view === "explore" ? (
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
            <TaxonomyBrowser />
          </div>
        </main>
      ) : view === "news" ? (
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
            <NewsFeed />
          </div>
        </main>
      ) : (
        <>
      {/* Conversation */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          {empty ? (
            <div className="mx-auto mt-4 max-w-2xl">
              {/* VIN lookup */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = vin.trim().toUpperCase();
                  if (v.length < 11) return;
                  send(`Look up the safety recalls and complaints for VIN ${v}.`);
                  setVin("");
                }}
                className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30"
              >
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Look up your RV by VIN</div>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Decodes the chassis make / model / year and pulls its recalls & complaints.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="17-character VIN"
                    maxLength={17}
                    disabled={loading}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm uppercase tracking-wide outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-900/40"
                  />
                  <button
                    type="submit"
                    disabled={loading || vin.trim().length < 11}
                    className="rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-900 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-800/30 transition hover:from-emerald-800 hover:to-emerald-950 disabled:opacity-40"
                  >
                    Look up
                  </button>
                </div>
              </form>

              <div className="flex items-center justify-center gap-3">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  What would you like to know?
                </h2>
                <button
                  onClick={() => setShuffle((n) => n + 1)}
                  title="Shuffle example questions"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                >
                  <span aria-hidden>🔀</span> Shuffle
                </button>
                <button
                  onClick={startComparison}
                  title="Compare two RV makes side by side"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:text-emerald-400"
                >
                  <span aria-hidden>⚖️</span> Compare RVs
                </button>
              </div>
              <div className="mt-5 space-y-4">
                {examples.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      {g.label}
                    </div>
                    {/* Mobile: horizontal snap-scroll; sm+: two-up grid. */}
                    <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
                      {g.items.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => send(ex)}
                          className="group flex min-w-[82%] snap-start items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-emerald-50/60 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20 sm:min-w-0"
                        >
                          <span>{ex}</span>
                          <span
                            aria-hidden
                            className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 dark:text-slate-500"
                          >
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-5">
              {(() => {
                const firstAnswer = messages.findIndex((x) => x.role === "assistant");
                return messages.map((m, i) => (
                  <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    {m.role === "user" ? (
                      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white shadow-sm dark:bg-slate-700">
                        {m.content}
                      </div>
                    ) : (
                      <AssistantMessage
                        m={m}
                        onExport={setReport}
                        onFollowup={send}
                        onRegenerate={send}
                        onExplore={openInExplore}
                        openProvenance={i === firstAnswer}
                      />
                    )}
                  </li>
                ));
              })()}
            </ul>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer className="shrink-0 border-t border-slate-200 bg-gradient-to-b from-slate-100 to-slate-200 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-slate-700 dark:from-slate-900 dark:to-slate-950 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex w-full max-w-4xl items-center gap-2 rounded-2xl border border-slate-300 bg-white p-2 pl-5 shadow-xl ring-1 ring-black/5 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-300 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/5 dark:focus-within:ring-emerald-700"
        >
          <input
            ref={composerRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a make, model year, defect, or trend…"
            disabled={loading}
            aria-label="Ask a question"
            className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400 disabled:opacity-60 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-800/35 transition hover:from-emerald-800 hover:to-emerald-950 disabled:opacity-40"
          >
            Ask
            <span aria-hidden className="text-base leading-none">→</span>
          </button>
        </form>
      </footer>
        </>
      )}
        </div>
      </div>
    </div>
    {report && <ReportView message={report} />}
    {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}
