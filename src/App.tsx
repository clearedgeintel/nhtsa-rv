import { useEffect, useRef, useState } from "react";
import { askAgent, groundingOf } from "./api";
import type { ChatMessage } from "./types";
import { AssistantMessage } from "./components/AssistantMessage";

const EXAMPLE_GROUPS = [
  {
    label: "Recalls",
    items: [
      "How many recalls involve Winnebago, including chassis?",
      "How many recall campaigns affect Grand Design 2024 models?",
    ],
  },
  {
    label: "Complaints",
    items: [
      "Which RV makes have the most fire-related complaints?",
      "How many critical-severity complaints does Forest River have?",
    ],
  },
  {
    label: "Trends & comparisons",
    items: [
      "Show Keystone recall campaigns by model year",
      "Compare total recalls between Winnebago and Grand Design",
    ],
  },
  {
    label: "Describe an issue",
    items: [
      "Complaints describing sudden brake loss going downhill",
      "Reports of water intrusion or roof leaks",
    ],
  },
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(
    () =>
      localStorage.getItem("theme") === "dark" ||
      (!localStorage.getItem("theme") && window.matchMedia?.("(prefers-color-scheme: dark)").matches),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    const res = await askAgent(q, history);
    setMessages((m) => [
      ...m,
      res.error
        ? { role: "assistant", content: `⚠️ ${res.error}`, isError: true }
        : {
            role: "assistant",
            content: res.answer || "(no answer returned)",
            question: q,
            grounding: groundingOf(res),
            sources: res.sources,
            sql_used: res.sql_used,
            narrative_hits: res.narrative_hits,
            charts: res.charts,
          },
    ]);
    setLoading(false);
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Hero header */}
      <header className="relative shrink-0 overflow-hidden">
        <img src="/rv.png" alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/40" />
        <div className="relative mx-auto flex w-full max-w-4xl items-start justify-between px-4 py-6 sm:px-6 [text-shadow:0_1px_3px_rgb(0_0_0_/_70%)]">
          <div>
            <span className="rounded-md bg-emerald-500/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/40 [text-shadow:none]">
              NHTSA · RV
            </span>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">RV Defect Intelligence</h1>
            <p className="mt-1 max-w-xl text-sm text-slate-100">
              Ask plain-English questions about RV recalls, complaints, investigations, and TSBs —
              every number is traceable to its source.
            </p>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            className="shrink-0 rounded-lg bg-white/10 px-2 py-1.5 text-sm text-white ring-1 ring-white/20 backdrop-blur hover:bg-white/20 [text-shadow:none]"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle dark mode"
          >
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* Conversation */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          {empty ? (
            <div className="mx-auto mt-4 max-w-2xl">
              <h2 className="text-center text-lg font-semibold text-slate-700 dark:text-slate-200">
                What would you like to know?
              </h2>
              <div className="mt-5 space-y-4">
                {EXAMPLE_GROUPS.map((g) => (
                  <div key={g.label}>
                    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                      {g.label}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.items.map((ex) => (
                        <button
                          key={ex}
                          onClick={() => send(ex)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-emerald-400 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-5">
              {messages.map((m, i) => (
                <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  {m.role === "user" ? (
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white shadow-sm dark:bg-slate-700">
                      {m.content}
                    </div>
                  ) : (
                    <AssistantMessage m={m} />
                  )}
                </li>
              ))}
              {loading && (
                <li className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-500" />
                    </span>
                    Querying the data…
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer className="shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex w-full max-w-4xl items-center gap-2 px-4 py-3 sm:px-6"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a make, model year, defect, or trend…"
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-emerald-900/40 dark:disabled:bg-slate-800/50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </footer>
    </div>
  );
}
