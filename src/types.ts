export type NarrativeHit = {
  odi_id: string;
  make_canonical: string;
  model: string | null;
  model_year: number | null;
  component: string | null;
  failure_mode: string | null;
  severity: string | null;
  narrative: string;
  similarity: number | string;
};

export type ChartSpec = {
  type: "bar" | "line";
  title: string;
  x_key: string;
  y_keys: string[];
  data: Record<string, string | number>[];
};

/** Shape returned by the `ask` Edge Function. */
export type AskResponse = {
  answer?: string;
  sources?: string[];
  sql_used?: string[];
  narrative_hits?: NarrativeHit[];
  charts?: ChartSpec[];
  error?: string;
};

/** How well-grounded an answer is, for the trust badge. */
export type Grounding = "sql" | "semantic" | "none";

/** A failure-mode row for the Explore taxonomy heatmap. */
export type FailureModeRow = {
  failure_mode: string;
  complaints: number;
  critical: number;
  severe: number;
  moderate: number;
  minor: number;
  makes: number;
};

/** Data-refresh status shown in the header (from app_meta). */
export type DataStatus = {
  refreshed_at: string;
  recalls: number;
  complaints: number;
  investigations: number;
  makes: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  // provenance (assistant only)
  sources?: string[];
  sql_used?: string[];
  narrative_hits?: NarrativeHit[];
  charts?: ChartSpec[];
  grounding?: Grounding;
  question?: string; // the user question this answers (for feedback)
  isError?: boolean;
  streaming?: boolean; // answer is still arriving
  status?: string; // current step label while streaming (e.g. "Querying the data…")
};
