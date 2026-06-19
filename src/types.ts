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

/** Shape returned by the `ask` Edge Function. */
export type AskResponse = {
  answer?: string;
  sources?: string[];
  sql_used?: string[];
  narrative_hits?: NarrativeHit[];
  error?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  // provenance (assistant only)
  sources?: string[];
  sql_used?: string[];
  narrative_hits?: NarrativeHit[];
  isError?: boolean;
};
