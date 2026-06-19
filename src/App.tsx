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

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">RV Defect Intelligence</h1>
        <p className="text-sm text-slate-500">
          Ask plain-English questions about NHTSA RV safety data — every number is traceable to a source.
        </p>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-6">
          {messages.length === 0 ? (
            <div className="mt-10 text-center">
              <p className="text-slate-400">Ask about recalls, complaints, investigations, or TSBs.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => send(ex)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-900"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((m, i) => (
                <li key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  {m.role === "user" ? (
                    <div className="max-w-[80%] rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
                      {m.content}
                    </div>
                  ) : (
                    <div
                      className={
                        "max-w-[90%] rounded-2xl px-4 py-3 shadow ring-1 " +
                        (m.isError ? "bg-red-50 ring-red-200" : "bg-white ring-slate-200")
                      }
                    >
                      <Markdown>{m.content}</Markdown>
                      {m.charts?.map((c, ci) => <Chart key={ci} spec={c} />)}
                      <Provenance
                        sqlUsed={m.sql_used}
                        sources={m.sources}
                        narrativeHits={m.narrative_hits}
                      />
                    </div>
                  )}
                </li>
              ))}
              {loading && (
                <li className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-slate-500 shadow ring-1 ring-slate-200">
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" />
                    </span>
                    Querying the data…
                  </div>
                </li>
              )}
            </ul>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex w-full max-w-3xl gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
