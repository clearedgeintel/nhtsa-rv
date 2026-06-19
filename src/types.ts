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
};
