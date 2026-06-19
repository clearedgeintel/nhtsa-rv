import { useState } from "react";
import type { ChatMessage, Grounding } from "../types";
import { submitFeedback } from "../api";
import { Markdown } from "./Markdown";
import { Chart } from "./Chart";
import { Provenance } from "./Provenance";

const BADGE: Record<Grounding, { dot: string; label: string; cls: string }> = {
  sql: { dot: "bg-emerald-500", label: "Grounded in data", cls: "text-emerald-700 dark:text-emerald-400" },
  semantic: { dot: "bg-amber-500", label: "Semantic match", cls: "text-amber-700 dark:text-amber-400" },
  none: { dot: "bg-slate-400", label: "No data sources", cls: "text-slate-600 dark:text-slate-400" },
};

export function AssistantMessage({ m }: { m: ChatMessage }) {
  const [copied, setCopied] = useState(false);
  const [rating, setRating] = useState<"up" | "down" | null>(null);

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

  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
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

      <Markdown>{m.content}</Markdown>
      {m.charts?.map((c, ci) => <Chart key={ci} spec={c} />)}
      <Provenance
        sqlUsed={m.sql_used}
        sources={m.sources}
        narrativeHits={m.narrative_hits}
        defaultOpen={autoOpen}
      />
    </div>
  );
}
