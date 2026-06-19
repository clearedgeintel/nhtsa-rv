import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { getExploreOptions, getFailureModes, getModeBreakdown, getModeDetails } from "../api";
import type { ComplaintDetail, ExploreFilters, ExploreOptions, FailureModeRow } from "../types";

// Severity columns with a safety-coded color (intensity scales with frequency).
const SEV = [
  { key: "minor", label: "Minor", rgb: "16,185,129" },
  { key: "moderate", label: "Moderate", rgb: "245,158,11" },
  { key: "severe", label: "Severe", rgb: "249,115,22" },
  { key: "critical", label: "Critical", rgb: "239,68,68" },
] as const;

const EMPTY_FILTERS: ExploreFilters = { make: null, my_from: null, my_to: null, recv_from: null, recv_to: null };

// ── CSV export ──────────────────────────────────────────────────────────────
function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (c: string | number | null) => `"${String(c ?? "").replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── URL state (share-this-view) ───────────────────────────────────────────────
type ExploreUrlState = { filters: ExploreFilters; selected: string | null; detail: string | null };

/** Read explore state from the current querystring (for share links + reloads). */
function readUrlState(): ExploreUrlState {
  const p = new URLSearchParams(window.location.search);
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : null);
  return {
    filters: {
      make: p.get("make"),
      my_from: num("myf"),
      my_to: num("myt"),
      recv_from: num("rf"),
      recv_to: num("rt"),
    },
    selected: p.get("mode"),
    detail: p.get("detail"), // severity key, or "all", when the drill-through is open
  };
}

/** Reflect explore state into the URL without adding history entries. */
function writeUrlState(s: ExploreUrlState) {
  const p = new URLSearchParams(window.location.search);
  // Explore owns these keys; clear then re-set so stale params don't linger.
  ["view", "make", "myf", "myt", "rf", "rt", "mode", "detail"].forEach((k) => p.delete(k));
  p.set("view", "explore");
  const set = (k: string, v: string | number | null) => v != null && v !== "" && p.set(k, String(v));
  set("make", s.filters.make);
  set("myf", s.filters.my_from);
  set("myt", s.filters.my_to);
  set("rf", s.filters.recv_from);
  set("rt", s.filters.recv_to);
  set("mode", s.selected);
  set("detail", s.detail);
  const qs = p.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

type Breakdown = {
  components: { component: string; n: number }[];
  makes: { make_canonical: string; n: number }[];
};

const selectCls =
  "rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 shadow-sm " +
  "focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 " +
  "dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

function yearRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let y = to; y >= from; y--) out.push(y);
  return out;
}

/** A labeled from/to pair of year dropdowns sharing one option range. */
function YearRange({
  label,
  years,
  from,
  to,
  onFrom,
  onTo,
}: {
  label: string;
  years: number[];
  from: number | null;
  to: number | null;
  onFrom: (v: number | null) => void;
  onTo: (v: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
      <span className="font-medium">{label}</span>
      <select className={selectCls} value={from ?? ""} onChange={(e) => onFrom(e.target.value ? +e.target.value : null)}>
        <option value="">From</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <span className="text-slate-400">–</span>
      <select className={selectCls} value={to ?? ""} onChange={(e) => onTo(e.target.value ? +e.target.value : null)}>
        <option value="">To</option>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </label>
  );
}

function FilterBar({
  options,
  filters,
  setFilters,
}: {
  options: ExploreOptions | null;
  filters: ExploreFilters;
  setFilters: (f: ExploreFilters) => void;
}) {
  const myYears = useMemo(() => (options ? yearRange(options.my_min, options.my_max) : []), [options]);
  const recvYears = useMemo(() => (options ? yearRange(options.recv_min, options.recv_max) : []), [options]);
  const active =
    filters.make !== null ||
    filters.my_from !== null ||
    filters.my_to !== null ||
    filters.recv_from !== null ||
    filters.recv_to !== null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium">Brand</span>
        <select
          className={selectCls + " max-w-[12rem]"}
          value={filters.make ?? ""}
          onChange={(e) => setFilters({ ...filters, make: e.target.value || null })}
        >
          <option value="">All brands</option>
          {options?.makes.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <YearRange
        label="Model year"
        years={myYears}
        from={filters.my_from}
        to={filters.my_to}
        onFrom={(v) => setFilters({ ...filters, my_from: v })}
        onTo={(v) => setFilters({ ...filters, my_to: v })}
      />

      <YearRange
        label="Reported (NHTSA)"
        years={recvYears}
        from={filters.recv_from}
        to={filters.recv_to}
        onFrom={(v) => setFilters({ ...filters, recv_from: v })}
        onTo={(v) => setFilters({ ...filters, recv_to: v })}
      />

      {active && (
        <button
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Bars({ title, rows, label }: { title: string; rows: { name: string; n: number }[]; label: string }) {
  const max = rows[0]?.n ?? 1;
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No data.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.name} className="text-xs">
              <div className="mb-0.5 flex justify-between gap-2">
                <span className="truncate text-slate-700 dark:text-slate-200" title={r.name}>{r.name}</span>
                <span className="shrink-0 font-mono text-slate-500 dark:text-slate-400">{r.n.toLocaleString()}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="sr-only">{label}</div>
    </div>
  );
}

export function TaxonomyBrowser() {
  const initial = useRef<ExploreUrlState>(readUrlState());
  const [options, setOptions] = useState<ExploreOptions | null>(null);
  const [filters, setFilters] = useState<ExploreFilters>(initial.current.filters);
  const [modes, setModes] = useState<FailureModeRow[]>([]);
  const [loadingModes, setLoadingModes] = useState(true);
  const [selected, setSelected] = useState<string | null>(initial.current.selected);
  const [breakdown, setBreakdown] = useState<Breakdown>({ components: [], makes: [] });
  const [loadingDetail, setLoadingDetail] = useState(false);
  // "What's behind this number" drill-through: a clicked heatmap cell (mode + optional severity).
  const [cell, setCell] = useState<{ mode: string; severity: string | null } | null>(
    initial.current.selected && initial.current.detail
      ? { mode: initial.current.selected, severity: initial.current.detail === "all" ? null : initial.current.detail }
      : null,
  );
  const [details, setDetails] = useState<ComplaintDetail[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const firstFilterRun = useRef(true); // don't wipe a URL-restored drill-through on mount

  useEffect(() => {
    getExploreOptions().then(setOptions);
  }, []);

  // Re-fetch the heatmap whenever the slicers change.
  useEffect(() => {
    setLoadingModes(true);
    if (firstFilterRun.current) firstFilterRun.current = false;
    else setCell(null); // changing a slicer collapses the drill-through (its rows may no longer match)
    getFailureModes(filters).then((m) => {
      setModes(m);
      setLoadingModes(false);
      // Keep the current selection if it survives the filter; otherwise pick the top row.
      setSelected((prev) => (prev && m.some((r) => r.failure_mode === prev) ? prev : m[0]?.failure_mode ?? null));
    });
  }, [filters]);

  // Keep the URL in sync so the view is shareable / reload-safe.
  useEffect(() => {
    writeUrlState({ filters, selected, detail: cell ? cell.severity ?? "all" : null });
  }, [filters, selected, cell]);

  // Fetch the underlying complaint records when a number is clicked.
  useEffect(() => {
    if (!cell) {
      setDetails([]);
      return;
    }
    let alive = true;
    setLoadingDetails(true);
    getModeDetails(cell.mode, cell.severity, filters, 25).then((d) => {
      if (!alive) return;
      setDetails(d);
      setLoadingDetails(false);
    });
    return () => {
      alive = false;
    };
  }, [cell, filters]);

  // Drill-down honors the same slicers.
  useEffect(() => {
    if (!selected) {
      setBreakdown({ components: [], makes: [] });
      return;
    }
    setLoadingDetail(true);
    getModeBreakdown(selected, filters).then((b) => {
      setBreakdown(b);
      setLoadingDetail(false);
    });
  }, [selected, filters]);

  // Per-severity-column max for the heatmap intensity scaling.
  const colMax = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of SEV) m[s.key] = Math.max(1, ...modes.map((r) => r[s.key as keyof FailureModeRow] as number));
    return m;
  }, [modes]);

  const [shared, setShared] = useState(false);
  const slug = (filterSummary(filters) || "all").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  function exportHeatmapCsv() {
    downloadCsv(
      `rv-taxonomy-${slug}.csv`,
      ["failure_mode", "minor", "moderate", "severe", "critical", "total", "makes"],
      modes.map((r) => [r.failure_mode, r.minor, r.moderate, r.severe, r.critical, r.complaints, r.makes]),
    );
  }
  function exportDetailsCsv() {
    if (!cell) return;
    downloadCsv(
      `rv-complaints-${cell.mode}-${cell.severity ?? "all"}-${slug}.csv`.replace(/[^a-z0-9.\-_]+/gi, "-"),
      ["odi_id", "make", "model", "model_year", "component", "severity", "date_received", "narrative"],
      details.map((d) => [d.odi_id, d.make_canonical, d.model, d.model_year, d.component, d.severity, d.date_received, d.narrative]),
    );
  }
  function copyShareLink() {
    navigator.clipboard?.writeText(window.location.href).then(
      () => {
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      },
      () => {},
    );
  }

  // Roving-tabindex keyboard nav across the heatmap grid: col 0 = mode name,
  // cols 1–4 = severities, col 5 = total. Arrow keys move; Enter/Space activates.
  const GRID_COLS = 6;
  const [focusPos, setFocusPos] = useState<[number, number]>([0, 0]);
  function moveFocus(e: KeyboardEvent, ri: number, ci: number) {
    let [r, c] = [ri, ci];
    switch (e.key) {
      case "ArrowRight": c = Math.min(GRID_COLS - 1, c + 1); break;
      case "ArrowLeft": c = Math.max(0, c - 1); break;
      case "ArrowDown": r = Math.min(modes.length - 1, r + 1); break;
      case "ArrowUp": r = Math.max(0, r - 1); break;
      case "Home": c = 0; break;
      case "End": c = GRID_COLS - 1; break;
      default: return;
    }
    e.preventDefault();
    setFocusPos([r, c]);
    document.getElementById(`htm-${r}-${c}`)?.focus();
  }
  const tab = (ri: number, ci: number) => (focusPos[0] === ri && focusPos[1] === ci ? 0 : -1);

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Defect taxonomy</h2>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        Complaint failure modes by severity. Slice by brand and year, click a row for its top components and
        makes, or click any number to see the complaints behind it.
      </p>

      <FilterBar options={options} filters={filters} setFilters={setFilters} />

      {/* View actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={exportHeatmapCsv}
          disabled={modes.length === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500"
        >
          ⤓ Export CSV
        </button>
        <button
          onClick={copyShareLink}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500"
        >
          {shared ? "✓ Link copied" : "🔗 Share this view"}
        </button>
        <span className="text-[11px] text-slate-400">
          {modes.length.toLocaleString()} failure modes{filterSummary(filters) ? ` · ${filterSummary(filters)}` : ""}
        </span>
      </div>

      {/* Heatmap */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm" role="grid">
          <caption className="sr-only">
            RV complaint failure modes by severity. Use arrow keys to move between cells, Enter or Space to drill in.
          </caption>
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th scope="col" className="px-3 py-2 text-left font-semibold">Failure mode</th>
              {SEV.map((s) => (
                <th scope="col" key={s.key} className="px-2 py-2 text-center font-semibold">{s.label}</th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-semibold">Total</th>
              <th scope="col" className="px-3 py-2 text-right font-semibold">Makes</th>
            </tr>
          </thead>
          <tbody>
            {loadingModes ? (
              <tr>
                <td colSpan={SEV.length + 3} className="px-3 py-6 text-center text-sm text-slate-400">Loading…</td>
              </tr>
            ) : modes.length === 0 ? (
              <tr>
                <td colSpan={SEV.length + 3} className="px-3 py-6 text-center text-sm text-slate-400">
                  No complaints match these filters.
                </td>
              </tr>
            ) : (
              modes.map((r, ri) => {
                const sel = r.failure_mode === selected;
                const selectMode = () => {
                  setSelected(r.failure_mode);
                  setCell(null);
                };
                return (
                  <tr
                    key={r.failure_mode}
                    onClick={selectMode}
                    className={
                      "cursor-pointer border-b border-slate-100 last:border-0 dark:border-slate-700/60 " +
                      (sel ? "bg-emerald-50 dark:bg-emerald-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/40")
                    }
                  >
                    <td className="px-3 py-1.5">
                      <span
                        id={`htm-${ri}-0`}
                        role="button"
                        tabIndex={tab(ri, 0)}
                        aria-label={`${r.failure_mode}: ${r.complaints.toLocaleString()} complaints. Show its top components and makes.`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectMode();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectMode();
                          } else moveFocus(e, ri, 0);
                        }}
                        className="inline-block cursor-pointer rounded font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-slate-200"
                      >
                        {r.failure_mode}
                      </span>
                    </td>
                    {SEV.map((s, si) => {
                      const ci = si + 1;
                      const v = r[s.key as keyof FailureModeRow] as number;
                      const a = v === 0 ? 0 : 0.15 + 0.85 * (v / colMax[s.key]);
                      const active = cell?.mode === r.failure_mode && cell?.severity === s.key;
                      const open = () => {
                        if (v === 0) return;
                        setSelected(r.failure_mode);
                        setCell({ mode: r.failure_mode, severity: s.key });
                      };
                      return (
                        <td key={s.key} className="px-1 py-1 text-center">
                          <div
                            id={`htm-${ri}-${ci}`}
                            role="button"
                            tabIndex={tab(ri, ci)}
                            aria-pressed={active}
                            aria-label={`${v.toLocaleString()} ${s.label.toLowerCase()}-severity ${r.failure_mode} complaints${v > 0 ? ", show them" : ""}`}
                            onClick={(e) => {
                              (e as MouseEvent).stopPropagation();
                              open();
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                open();
                              } else moveFocus(e, ri, ci);
                            }}
                            className={
                              "rounded py-1 text-xs tabular-nums outline-none transition focus-visible:ring-2 focus-visible:ring-emerald-600 " +
                              (v > 0 ? "cursor-pointer hover:ring-2 hover:ring-slate-900/30 dark:hover:ring-white/40 " : "") +
                              (active ? "ring-2 ring-slate-900 dark:ring-white " : "")
                            }
                            style={{
                              backgroundColor: `rgba(${s.rgb},${a})`,
                              color: a > 0.55 ? "white" : "rgb(51,65,85)",
                            }}
                          >
                            {v.toLocaleString()}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right">
                      <button
                        id={`htm-${ri}-5`}
                        tabIndex={tab(ri, 5)}
                        aria-pressed={cell?.mode === r.failure_mode && cell?.severity === null}
                        aria-label={`All ${r.failure_mode} complaints: ${r.complaints.toLocaleString()}. Show them.`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(r.failure_mode);
                          setCell({ mode: r.failure_mode, severity: null });
                        }}
                        onKeyDown={(e) => moveFocus(e, ri, 5)}
                        className={
                          "rounded px-1.5 py-0.5 font-mono text-slate-700 outline-none transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-600 dark:text-slate-200 dark:hover:bg-slate-600 " +
                          (cell?.mode === r.failure_mode && cell?.severity === null ? "bg-slate-200 ring-1 ring-slate-400 dark:bg-slate-600" : "")
                        }
                      >
                        {r.complaints.toLocaleString()}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-slate-500 dark:text-slate-400">{r.makes}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Drill-down */}
      {selected && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {selected}
            </span>{" "}
            <span className="font-normal text-slate-500 dark:text-slate-400">— top components &amp; makes</span>
          </div>
          {loadingDetail ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              <Bars title="Top components" label="components" rows={breakdown.components.map((c) => ({ name: c.component, n: c.n }))} />
              <Bars title="Top makes" label="makes" rows={breakdown.makes.map((m) => ({ name: m.make_canonical, n: m.n }))} />
            </div>
          )}
        </div>
      )}

      {/* Drill-through: the actual complaint records behind a clicked number */}
      {cell && (
        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Complaints behind this number{" "}
              <span className="ml-1 font-normal text-slate-500 dark:text-slate-400">
                {cell.mode}
                {cell.severity ? ` · ${cell.severity}` : " · all severities"}
                {filterSummary(filters) ? ` · ${filterSummary(filters)}` : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {details.length > 0 && (
                <button
                  onClick={exportDetailsCsv}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  ⤓ Export CSV
                </button>
              )}
              <button
                onClick={() => setCell(null)}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                ✕ Close
              </button>
            </div>
          </div>

          {loadingDetails ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : details.length === 0 ? (
            <p className="text-sm text-slate-400">No complaint records found.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {details.map((d) => (
                  <li key={d.odi_id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 dark:border-slate-700 dark:bg-slate-800/60">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                        ODI {d.odi_id}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {d.make_canonical} {d.model_year ?? ""} {d.model ?? ""}
                      </span>
                      {d.component && <span className="rounded bg-slate-100 px-1 dark:bg-slate-700">{d.component}</span>}
                      {d.severity && (
                        <span className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{d.severity}</span>
                      )}
                      {d.date_received && <span className="ml-auto">{d.date_received}</span>}
                    </div>
                    <p className="line-clamp-3 text-[12px] leading-snug text-slate-700 dark:text-slate-300" title={d.narrative}>
                      {d.narrative}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] text-slate-400">
                Showing {details.length} most recent{details.length >= 25 ? " (max 25)" : ""}. Source: NHTSA complaint
                database — verify any ODI number at nhtsa.gov.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact one-line summary of the active slicers for the drill-through header. */
function filterSummary(f: ExploreFilters): string {
  const parts: string[] = [];
  if (f.make) parts.push(f.make);
  if (f.my_from || f.my_to) parts.push(`MY ${f.my_from ?? "…"}–${f.my_to ?? "…"}`);
  if (f.recv_from || f.recv_to) parts.push(`reported ${f.recv_from ?? "…"}–${f.recv_to ?? "…"}`);
  return parts.join(" · ");
}
