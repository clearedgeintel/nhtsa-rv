import { useState } from "react";
import type { NarrativeHit } from "../types";

type Props = {
  sqlUsed?: string[];
  sources?: string[];
  narrativeHits?: NarrativeHit[];
  defaultOpen?: boolean;
};

/** Link a "campaign_id:XXXX" source to NHTSA so the user can verify it. */
function sourceLink(src: string): string | null {
  const [kind, id] = src.split(":");
  if (kind === "campaign_id") return `https://www.nhtsa.gov/recalls?nhtsaId=${id}`;
  return null;
}

/** Build + download a CSV of every cited source with NHTSA links. */
function exportCsv(sources: string[], hits: NarrativeHit[]) {
  const rows: string[][] = [["type", "id", "nhtsa_url"]];
  for (const s of sources) {
    const [kind, id] = s.split(":");
    rows.push([kind, id, sourceLink(s) ?? ""]);
  }
  for (const h of hits) {
    if (!sources.some((s) => s.endsWith(`:${h.odi_id}`))) rows.push(["odi_id", h.odi_id, ""]);
  }
  const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "rv-defect-sources.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function Provenance({ sqlUsed, sources, narrativeHits, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const hasAny =
    (sqlUsed?.length ?? 0) > 0 || (sources?.length ?? 0) > 0 || (narrativeHits?.length ?? 0) > 0;
  if (!hasAny) return null;

  const canExport = (sources?.length ?? 0) > 0 || (narrativeHits?.length ?? 0) > 0;

  return (
    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <span className={"transition-transform " + (open ? "rotate-90" : "")}>▶</span>
          How I got this
          <span className="text-slate-400 dark:text-slate-500">
            ({sqlUsed?.length ?? 0} queries · {sources?.length ?? 0} sources ·{" "}
            {narrativeHits?.length ?? 0} narratives)
          </span>
        </button>
        {canExport && (
          <button
            onClick={() => exportCsv(sources ?? [], narrativeHits ?? [])}
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            ⤓ Export sources
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-3 text-xs">
          {!!sqlUsed?.length && (
            <section>
              <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">SQL executed</div>
              <div className="space-y-2">
                {sqlUsed.map((q, i) => (
                  <pre
                    key={i}
                    className="overflow-x-auto rounded bg-slate-900 p-2 font-mono text-[11px] leading-snug text-slate-100 dark:bg-black/50"
                  >
                    {q}
                  </pre>
                ))}
              </div>
            </section>
          )}

          {!!sources?.length && (
            <section>
              <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Sources</div>
              <div className="flex flex-wrap gap-1">
                {sources.map((s) => {
                  const href = sourceLink(s);
                  const cls =
                    "rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-800";
                  return href ? (
                    <a key={s} href={href} target="_blank" rel="noreferrer" className={cls + " text-blue-600 underline dark:text-blue-400"}>
                      {s}
                    </a>
                  ) : (
                    <span key={s} className={cls + " text-slate-600 dark:text-slate-300"}>
                      {s}
                    </span>
                  );
                })}
              </div>
            </section>
          )}

          {!!narrativeHits?.length && (
            <section>
              <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">Matched narratives</div>
              <div className="space-y-2">
                {narrativeHits.map((h) => (
                  <div key={h.odi_id} className="rounded border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono">ODI {h.odi_id}</span>
                      <span>
                        {h.make_canonical} {h.model_year ?? ""} {h.model ?? ""}
                      </span>
                      {h.failure_mode && (
                        <span className="rounded bg-slate-100 px-1 dark:bg-slate-700">{h.failure_mode}</span>
                      )}
                      {h.severity && (
                        <span className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{h.severity}</span>
                      )}
                      <span className="ml-auto">sim {h.similarity}</span>
                    </div>
                    <p className="text-[11px] leading-snug text-slate-700 dark:text-slate-300">{h.narrative}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
