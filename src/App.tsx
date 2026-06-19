import { useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

/**
 * Milestone 1 placeholder chat shell.
 * No network calls yet — the `ask` Edge Function is wired up in milestone 4.
 * This exists only to confirm the Vite + Tailwind scaffold renders.
 */
export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    // Placeholder only: echo the question and a stub. Replaced by the agent in milestone 4.
    setMessages((m) => [
      ...m,
      { role: "user", content: text },
      {
        role: "assistant",
        content:
          "(Not wired up yet — the `ask` agent endpoint arrives in milestone 4.)",
      },
    ]);
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold">RV Defect Intelligence</h1>
        <p className="text-sm text-slate-500">
          Ask plain-English questions about NHTSA RV safety data.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-y-auto px-6 py-6">
        {messages.length === 0 ? (
          <div className="m-auto text-center text-slate-400">
            <p>No messages yet.</p>
            <p className="text-sm">
              Try: “How many recalls on Winnebago Class A motorhomes in 2024?”
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {messages.map((m, i) => (
              <li
                key={i}
                className={
                  m.role === "user" ? "flex justify-end" : "flex justify-start"
                }
              >
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm " +
                    (m.role === "user"
                      ? "bg-slate-900 text-white"
                      : "bg-white shadow ring-1 ring-slate-200")
                  }
                >
                  {m.content}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4">
        <form
          onSubmit={handleSend}
          className="mx-auto flex w-full max-w-3xl gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}
