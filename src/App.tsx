import { useEffect, useRef, useState } from "react";
import { askAgent } from "./api";
import type { ChatMessage } from "./types";
import { Markdown } from "./components/Markdown";
import { Provenance } from "./components/Provenance";
import { Chart } from "./components/Chart";

const EXAMPLES = [
  "How many recalls involve Winnebago, including chassis?",
  "How many recall campaigns affect Winnebago 2024 models?",
  "Find complaints describing sudden brake loss going downhill",
  "Which RV makes have the most fire-related complaints?",
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-screen flex-col bg-slate-100 text-slate-900">
      {/* Hero header */}
      <header className="relative shrink-0 overflow-hidden">
        <img
          src="/rv.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-right"
        />
        {/* Legibility: a near-solid dark base + a left-heavy gradient so text reads over any part of the photo. */}
        <div className="absolute inset-0 bg-slate-950/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/40" />
        <div className="relative mx-auto w-full max-w-4xl px-6 py-6 [text-shadow:0_1px_3px_rgb(0_0_0_/_70%)]">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-emerald-500/25 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 ring-1 ring-emerald-400/40 [text-shadow:none]">
              NHTSA · RV
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">RV Defect Intelligence</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-100">
            Ask plain-English questions about RV recalls, complaints, investigations, and TSBs —
            every number is traceable to its source.
          </p>
        </div>
      </header>

      {/* Conversation */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          {empty ? (
            <div className="mx-auto mt-6 max-w-2xl text-center">
              <h2 className="text-lg font-semibold text-slate-700">What would you like to know?</h2>
              <p className="mt-1 text-sm text-slate-500">
                Try one of these, or ask your own question.
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-sm transition hover:border-emerald-400 hover:shadow"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-5">
              {messages.map((m, i) => (
                <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  {m.role === "user" ? (
                    <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white shadow-sm">
                      {m.content}
                    </div>
                  ) : (
                    <div
                      className={
                        "max-w-[92%] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm ring-1 " +
                        (m.isError ? "bg-red-50 ring-red-200" : "bg-white ring-slate-200")
                      }
                    >
                      <Markdown>{m.content}</Markdown>
                      {m.charts?.map((c, ci) => <Chart key={ci} spec={c} />)}
                      <Provenance sqlUsed={m.sql_used} sources={m.sources} narrativeHits={m.narrative_hits} />
                    </div>
                  )}
                </li>
              ))}
              {loading && (
                <li className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
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
      <footer className="shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur">
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
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
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
