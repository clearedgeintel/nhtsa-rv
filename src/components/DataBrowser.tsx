import { useEffect, useState } from "react";
import { DATASETS, fetchPage, exportCsv, type Dataset } from "../lib/rawData";

const PAGE = 50;

function cell(v: unknown): string {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export function DataBrowser() {
  const [ds, setDs] = useState<Dataset>(DATASETS[0]);
  const [order, setOrder] = useState(DATASETS[0].defaultSort);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPage(ds, { limit: PAGE, offset: page * PAGE, order, search }).then((r) => {
      if (!alive) return;
      setRows(r.rows);
      setTotal(r.total);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [ds, order, search, page]);

  function selectDataset(d: Dataset) {
    setDs(d);
    setOrder(d.defaultSort);
    setSearchInput("");
    setSearch("");
    setPage(0);
  }
  function toggleSort(col: string) {
    const [c, dir] = order.split(".");
    setOrder(c === col && dir === "asc" ? `${col}.desc` : `${col}.asc`);
    setPage(0);
  }
  async function doExport() {
    setExporting(true);
    await exportCsv(ds, order, search);
    setExporting(false);
  }

  const [sortCol, sortDir] = order.split(".");
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const from = total === 0 ? 0 : page * PAGE + 1;
  const to = Math.min(total, (page + 1) * PAGE);
  const btn =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:border-emerald-500 hover:text-emerald-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-emerald-500";

  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Raw data</h2>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        Browse the source NHTSA records behind every answer. Sort, search, and export to CSV.
      </p>

      {/* Dataset tabs */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {DATASETS.map((d) => (
          <button
            key={d.key}
            onClick={() => selectDataset(d)}
            className={
              "rounded-lg px-3 py-1 text-xs font-semibold transition " +
              (d.key === ds.key
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-slate-300 bg-white text-slate-600 hover:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300")
            }
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={`Search ${ds.label.toLowerCase()}…`}
          className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        <button onClick={doExport} disabled={exporting || total === 0} className={btn}>
          {exporting ? "Exporting…" : "⤓ Export CSV"}
        </button>
        <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">
          {loading ? "Loading…" : `${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
        </span>
      </div>

      {/* Grid */}
      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
            <tr>
              {ds.columns.map((c) => {
                const active = sortCol === c.key;
                return (
                  <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400" title={`Sort by ${c.label}`}>
                      {c.label}
                      <span aria-hidden className={active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-300 dark:text-slate-600"}>
                        {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={ds.columns.length} className="px-3 py-8 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={ds.columns.length} className="px-3 py-8 text-center text-slate-400">No rows{search ? " match your search" : ""}.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50 dark:border-slate-700/60 dark:hover:bg-slate-700/30">
                  {ds.columns.map((c) => {
                    const text = cell(r[c.key]);
                    return (
                      <td
                        key={c.key}
                        className={
                          "px-3 py-1.5 " +
                          (c.wide
                            ? "min-w-[16rem] max-w-md text-slate-600 dark:text-slate-300"
                            : "whitespace-nowrap text-slate-700 dark:text-slate-200")
                        }
                      >
                        {c.wide ? (
                          <span className="line-clamp-2" title={text}>{text}</span>
                        ) : (
                          text
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{ds.blurb}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(0)} disabled={page === 0 || loading} className={btn} title="First page">«</button>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading} className={btn}>‹ Prev</button>
          <span className="text-xs text-slate-500 dark:text-slate-400">Page {page + 1} / {pages.toLocaleString()}</span>
          <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1 || loading} className={btn}>Next ›</button>
        </div>
      </div>
    </div>
  );
}
