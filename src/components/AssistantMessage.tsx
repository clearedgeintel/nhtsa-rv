import { useEffect, useState } from "react";
import type { ChatMessage, Grounding } from "../types";
import { submitFeedback } from "../api";
import { THINKING_MESSAGES } from "../lib/thinkingMessages";
import { Markdown } from "./Markdown";
import { Chart } from "./Chart";
import { Provenance, sourcesToMarkdown } from "./Provenance";
import { detectFailureModes, humanizeMode } from "../lib/failureModes";

// Trust badge: icon + tint communicates HOW the answer was grounded (not color alone).
const BADGE: Record<Grounding, { icon: string; label: string; cls: string }> = {
  sql: {
    icon: "▦",
    label: "Grounded · SQL",
    cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-800",
  },
  hybrid: {
    icon: "◆",
    label: "Hybrid · SQL + semantic",
    cls: "bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-800",
  },
  semantic: {
    icon: "≈",
    label: "Semantic match",
    cls: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-800",
  },
  none: {
    icon: "○",
    label: "Ungrounded",
    cls: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:ring-slate-600",
  },
};

/** Question + answer + sources as a portable Markdown block (for the Share action). */
function answerMarkdown(m: ChatMessage): string {
  const parts: string[] = [];
  if (m.question) parts.push(`**Q:** ${m.question}`, "");
  parts.push(m.content.trim());
  const src = sourcesToMarkdown(m.sources ?? [], m.narrative_hits ?? []);
  if (src) parts.push("", "**Sources**", src);
  parts.push("", "_via RV Defect Intelligence_");
  return parts.join("\n");
}

export function AssistantMessage({
  m,
  onExport,
  onFollowup,
  onRegenerate,
  onExplore,
  onSave,
  openProvenance,
}: {
  m: ChatMessage;
  onExport?: (m: ChatMessage) => void;
  onFollowup?: (q: string) => void;
  onRegenerate?: (q: string) => void;
  onExplore?: (mode: string) => void;
  onSave?: (q: string) => void;
  openProvenance?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
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

  function flash(set: (v: boolean) => void) {
    set(true);
    setTimeout(() => set(false), 1500);
  }
  function copy() {
    navigator.clipboard?.writeText(m.content).then(() => flash(setCopied));
  }
  function share() {
    navigator.clipboard?.writeText(answerMarkdown(m)).then(() => flash(setShared));
  }
  function rate(r: "up" | "down") {
    setRating(r);
    void submitFeedback(r, m);
  }
  const btn =
    "rounded px-1.5 py-0.5 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200";

  if (m.isError) {
    return (
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">
        <Markdown>{m.content}</Markdown>
      </div>
    );
  }

  const badge = BADGE[m.grounding ?? "none"];
  const autoOpen = openProvenance || (m.sources?.length ?? 0) > 5;
  const streaming = m.streaming;

  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      {!streaming && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 " + badge.cls}
            title={
              m.grounding === "hybrid"
                ? "Answer combines SQL aggregates with semantic narrative search"
                : m.grounding === "sql"
                  ? "Answer is computed from SQL queries over the data"
                  : m.grounding === "semantic"
                    ? "Answer is based on semantic narrative matches"
                    : "No tool results backed this answer — treat with caution"
            }
          >
            <span aria-hidden>{badge.icon}</span>
            {badge.label}
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={copy} className={btn} title="Copy answer text">
              {copied ? "✓ Copied" : "Copy"}
            </button>
            <button onClick={share} className={btn} title="Copy question + answer + sources as Markdown">
              {shared ? "✓ Copied" : "Share"}
            </button>
            {onRegenerate && m.question && (
              <button onClick={() => onRegenerate(m.question!)} className={btn} title="Ask this question again">
                ↻ Regenerate
              </button>
            )}
            {onSave && m.question && (
              <button
                onClick={() => {
                  onSave(m.question!);
                  flash(setSaved);
                }}
                className={btn}
                title="Save this question to your account"
              >
                {saved ? "✓ Saved" : "☆ Save"}
              </button>
            )}
            {onExport && (
              <button onClick={() => onExport(m)} className={btn} title="Export as a PDF report">
                Report
              </button>
            )}
            <span className="mx-0.5 h-3 w-px bg-slate-200 dark:bg-slate-600" />
            <button
              onClick={() => rate("up")}
              className={"rounded px-1 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 " + (rating === "up" ? "opacity-100" : "opacity-50 hover:opacity-100")}
              title="Helpful"
              aria-pressed={rating === "up"}
            >
              👍
            </button>
            <button
              onClick={() => rate("down")}
              className={"rounded px-1 py-0.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 " + (rating === "down" ? "opacity-100" : "opacity-50 hover:opacity-100")}
              title="Not helpful"
              aria-pressed={rating === "down"}
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
          {onExplore && (() => {
            const modes = detectFailureModes(m.content, m.narrative_hits);
            if (!modes.length) return null;
            return (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-400">Explore in taxonomy:</span>
                {modes.map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onExplore(mode)}
                    title={`Open the Explore tab filtered to "${humanizeMode(mode)}"`}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
                  >
                    <span aria-hidden>⌕</span> {humanizeMode(mode)}
                  </button>
                ))}
              </div>
            );
          })()}
          {!!m.followups?.length && onFollowup && (
            <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-700">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                You might also ask
              </div>
              <div className="flex flex-wrap gap-2">
                {m.followups.map((q) => (
                  <button
                    key={q}
                    onClick={() => onFollowup(q)}
                    className="group inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-300"
                  >
                    {q}
                    <span aria-hidden className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
