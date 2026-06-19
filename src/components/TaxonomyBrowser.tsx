import { useEffect, useMemo, useState } from "react";
import { getExploreOptions, getFailureModes, getModeBreakdown } from "../api";
import type { ExploreFilters, ExploreOptions, FailureModeRow } from "../types";

// Severity columns with a safety-coded color (intensity scales with frequency).
const SEV = [
  { key: "minor", label: "Minor", rgb: "16,185,129" },
  { key: "moderate", label: "Moderate", rgb: "245,158,11" },
  { key: "severe", label: "Severe", rgb: "249,115,22" },
  { key: "critical", label: "Critical", rgb: "239,68,68" },
] as const;

const EMPTY_FILTERS: ExploreFilters = { make: null, my_from: null, my_to: null, recv_from: null, recv_to: null };

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
  const [options, setOptions] = useState<ExploreOptions | null>(null);
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS);
  const [modes, setModes] = useState<FailureModeRow[]>([]);
  const [loadingModes, setLoadingModes] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown>({ components: [], makes: [] });
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    getExploreOptions().then(setOptions);
  }, []);

  // Re-fetch the heatmap whenever the slicers change.
  useEffect(() => {
    setLoadingModes(true);
    getFailureModes(filters).then((m) => {
      setModes(m);
      setLoadingModes(false);
      // Keep the current selection if it survives the filter; otherwise pick the top row.
      setSelected((prev) => (prev && m.some((r) => r.failure_mode === prev) ? prev : m[0]?.failure_mode ?? null));
    });
  }, [filters]);

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

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Defect taxonomy</h2>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        Complaint failure modes by severity. Slice by brand and year, then click a row for its top components and makes.
      </p>

      <FilterBar options={options} filters={filters} setFilters={setFilters} />

      {/* Heatmap */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <th className="px-3 py-2 text-left font-semibold">Failure mode</th>
              {SEV.map((s) => (
                <th key={s.key} className="px-2 py-2 text-center font-semibold">{s.label}</th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Makes</th>
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
              modes.map((r) => {
                const sel = r.failure_mode === selected;
                return (
                  <tr
                    key={r.failure_mode}
                    onClick={() => setSelected(r.failure_mode)}
                    className={
                      "cursor-pointer border-b border-slate-100 last:border-0 dark:border-slate-700/60 " +
                      (sel ? "bg-emerald-50 dark:bg-emerald-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-700/40")
                    }
                  >
                    <td className="px-3 py-1.5 font-medium text-slate-700 dark:text-slate-200">{r.failure_mode}</td>
                    {SEV.map((s) => {
                      const v = r[s.key as keyof FailureModeRow] as number;
                      const a = v === 0 ? 0 : 0.15 + 0.85 * (v / colMax[s.key]);
                      return (
                        <td key={s.key} className="px-1 py-1 text-center">
                          <div
                            className="rounded py-1 text-xs tabular-nums"
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
                    <td className="px-3 py-1.5 text-right font-mono text-slate-700 dark:text-slate-200">{r.complaints.toLocaleString()}</td>
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
    </div>
  );
}
