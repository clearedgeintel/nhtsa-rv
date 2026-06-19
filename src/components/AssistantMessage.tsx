import { useEffect, useState } from "react";
import type { ChatMessage, Grounding } from "../types";
import { submitFeedback } from "../api";
import { THINKING_MESSAGES } from "../lib/thinkingMessages";
import { Markdown } from "./Markdown";
import { Chart } from "./Chart";
import { Provenance } from "./Provenance";

const BADGE: Record<Grounding, { dot: string; label: string; cls: string }> = {
  sql: { dot: "bg-emerald-500", label: "Grounded in data", cls: "text-emerald-700 dark:text-emerald-400" },
  semantic: { dot: "bg-amber-500", label: "Semantic match", cls: "text-amber-700 dark:text-amber-400" },
  none: { dot: "bg-slate-400", label: "No data sources", cls: "text-slate-600 dark:text-slate-400" },
};

export function AssistantMessage({ m, onExport }: { m: ChatMessage; onExport?: (m: ChatMessage) => void }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  // Rotating RV-themed "thinking" message while the answer streams.
  const [phrase, setPhrase] = useState(
    () => THINKING_MESSAGES[Math.floor(Math.random() * THINKING_MESSAGES.length)],
  );
  useEffect(() => {
    if (!m.streaming) return;
    let i = THINKING_MESSAGES.indexOf(phrase);
    const id = setInterval(() => {
      i = (i + 1) % THINKING_MESSAGES.length;
      setPhrase(THINKING_MESSAGES[i]);
    }, 2200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.streaming]);

  function copy() {
    navigator.clipboard?.writeText(m.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  function rate(r: "up" | "down") {
    setRating(r);
    void submitFeedback(r, m);
  }

  if (m.isError) {
    return (
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
        <Markdown>{m.content}</Markdown>
      </div>
    );
  }

  const badge = BADGE[m.grounding ?? "none"];
  const autoOpen = (m.sources?.length ?? 0) > 5;
  const streaming = m.streaming;

  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      {!streaming && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className={"inline-flex items-center gap-1.5 text-[11px] font-medium " + badge.cls}>
            <span className={"h-1.5 w-1.5 rounded-full " + badge.dot} />
            {badge.label}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={copy}
              className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              title="Copy answer"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            {onExport && (
              <button
                onClick={() => onExport(m)}
                className="rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                title="Export as a PDF report"
              >
                Report
              </button>
            )}
            <button
              onClick={() => rate("up")}
              className={"rounded px-1 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 " + (rating === "up" ? "opacity-100" : "opacity-50 hover:opacity-100")}
              title="Helpful"
            >
              👍
            </button>
            <button
              onClick={() => rate("down")}
              className={"rounded px-1 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 " + (rating === "down" ? "opacity-100" : "opacity-50 hover:opacity-100")}
              title="Not helpful"
            >
              👎
            </button>
          </div>
        </div>
      )}

      {m.content && <Markdown>{m.content}</Markdown>}

      {streaming && (
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
          </span>
          <span className="italic">{phrase}</span>
        </div>
      )}

      {!streaming && (
        <>
          {m.charts?.map((c, ci) => <Chart key={ci} spec={c} />)}
          <Provenance
            sqlUsed={m.sql_used}
            sources={m.sources}
            narrativeHits={m.narrative_hits}
            defaultOpen={autoOpen}
          />
        </>
      )}
    </div>
  );
}
