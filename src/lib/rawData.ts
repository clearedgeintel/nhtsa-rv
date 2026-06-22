// Read-only access to the gold v_* views for the raw-data browser. Pages through the data
// with PostgREST (limit/offset + count=exact), supports column sort and a simple ilike
// search, and exports the current filtered/sorted set as CSV via Accept: text/csv.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const restHeaders = () => ({ apikey: ANON, Authorization: `Bearer ${ANON}` });

export type ColumnDef = { key: string; label: string; wide?: boolean };
export type Dataset = {
  key: string;
  view: string;
  label: string;
  blurb: string;
  columns: ColumnDef[];
  searchCols: string[];
  defaultSort: string; // e.g. "recall_date.desc"
};

export const DATASETS: Dataset[] = [
  {
    key: "recalls",
    view: "v_recalls",
    label: "Recalls",
    blurb: "NHTSA recall campaigns filed against the RV universe.",
    columns: [
      { key: "campaign_id", label: "Campaign ID" },
      { key: "make_canonical", label: "Make" },
      { key: "model", label: "Model" },
      { key: "model_year", label: "Year" },
      { key: "component", label: "Component" },
      { key: "recall_date", label: "Date" },
      { key: "affected_units", label: "Units" },
      { key: "is_chassis", label: "Chassis" },
      { key: "summary", label: "Summary", wide: true },
      { key: "consequence", label: "Consequence", wide: true },
      { key: "remedy", label: "Remedy", wide: true },
    ],
    searchCols: ["campaign_id", "make_canonical", "model", "component", "summary"],
    defaultSort: "recall_date.desc",
  },
  {
    key: "complaints",
    view: "v_complaints",
    label: "Complaints",
    blurb: "Owner complaint reports (ODI), with ingest-classified failure mode + severity.",
    columns: [
      { key: "odi_id", label: "ODI ID" },
      { key: "make_canonical", label: "Make" },
      { key: "model", label: "Model" },
      { key: "model_year", label: "Year" },
      { key: "component", label: "Component" },
      { key: "date_received", label: "Received" },
      { key: "failure_mode", label: "Failure mode" },
      { key: "severity", label: "Severity" },
      { key: "narrative", label: "Narrative", wide: true },
    ],
    searchCols: ["odi_id", "make_canonical", "model", "component", "narrative"],
    defaultSort: "date_received.desc",
  },
  {
    key: "investigations",
    view: "v_investigations",
    label: "Investigations",
    blurb: "NHTSA ODI investigations (open/close, subject).",
    columns: [
      { key: "odi_action_no", label: "Action #" },
      { key: "make_canonical", label: "Make" },
      { key: "component", label: "Component" },
      { key: "open_date", label: "Opened" },
      { key: "close_date", label: "Closed" },
      { key: "subject", label: "Subject", wide: true },
      { key: "summary", label: "Summary", wide: true },
    ],
    searchCols: ["odi_action_no", "make_canonical", "component", "subject"],
    defaultSort: "open_date.desc",
  },
  {
    key: "tsbs",
    view: "v_tsbs",
    label: "TSBs",
    blurb: "Technical Service Bulletins (loaded when the NHTSA source is available).",
    columns: [
      { key: "tsb_id", label: "TSB ID" },
      { key: "make_canonical", label: "Make" },
      { key: "model", label: "Model" },
      { key: "model_year", label: "Year" },
      { key: "component", label: "Component" },
      { key: "summary", label: "Summary", wide: true },
    ],
    searchCols: ["tsb_id", "make_canonical", "model", "component"],
    defaultSort: "tsb_id.asc",
  },
  {
    key: "makes",
    view: "v_rv_makes",
    label: "RV makes",
    blurb: "Curated make reference: variant spellings → canonical, category, chassis flag.",
    columns: [
      { key: "make_canonical", label: "Canonical make" },
      { key: "category", label: "Category" },
      { key: "is_motorhome_chassis", label: "Chassis make" },
      { key: "make_variants", label: "Variant spellings", wide: true },
    ],
    searchCols: ["make_canonical", "category"],
    defaultSort: "make_canonical.asc",
  },
];

function buildQuery(ds: Dataset, order: string, search: string): string {
  let q = `select=*&order=${order}`;
  const term = search.replace(/[(),*]/g, " ").trim();
  if (term) {
    const enc = encodeURIComponent(`*${term}*`);
    q += `&or=(${ds.searchCols.map((c) => `${c}.ilike.${enc}`).join(",")})`;
  }
  return q;
}

export async function fetchPage(
  ds: Dataset,
  opts: { limit: number; offset: number; order: string; search: string },
): Promise<{ rows: Record<string, unknown>[]; total: number }> {
  const q = buildQuery(ds, opts.order, opts.search);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ds.view}?${q}&limit=${opts.limit}&offset=${opts.offset}`, {
    headers: { ...restHeaders(), Prefer: "count=exact" },
  });
  if (!res.ok) return { rows: [], total: 0 };
  const rows = (await res.json()) as Record<string, unknown>[];
  const cr = res.headers.get("content-range"); // "0-49/2650"
  const total = cr && cr.includes("/") ? parseInt(cr.split("/")[1], 10) || rows.length : rows.length;
  return { rows, total };
}

/** Download the current filtered/sorted dataset as CSV (capped) straight from PostgREST. */
export async function exportCsv(ds: Dataset, order: string, search: string, cap = 10000): Promise<void> {
  const q = buildQuery(ds, order, search);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ds.view}?${q}&limit=${cap}`, {
    headers: { ...restHeaders(), Accept: "text/csv" },
  });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nhtsa-${ds.key}${search ? "-filtered" : ""}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
