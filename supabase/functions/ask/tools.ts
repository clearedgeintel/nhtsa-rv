// tools.ts — the two agent tools (CLAUDE.md §6).
//   execute_sql       : model-generated read-only SQL, run inside the cage.
//   search_narratives : Voyage embed → pgvector cosine search (trusted, server-built).

import postgres from "postgres";
import { guardSql, DEFAULT_ROW_LIMIT } from "./sql_guard.ts";

const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
// prepare:false → compatible with the transaction pooler. Small pool for a serverless fn.
const sql = postgres(DB_URL, { prepare: false, max: 5, idle_timeout: 20 });

// ---- Tool input schemas (sent to the Anthropic API) ----
export const TOOL_DEFS = [
  {
    name: "execute_sql",
    description:
      "Run ONE read-only SELECT against the RV defect views (v_recalls, v_recall_vehicles, " +
      "v_complaints, v_investigations, v_tsbs, v_rv_makes). Returns JSON rows. Use for counts, " +
      "filters, aggregations, comparisons, and time series.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "A single SELECT (or WITH…SELECT) statement." } },
      required: ["query"],
    },
  },
  {
    name: "search_narratives",
    description:
      "Semantic search over complaint narratives. Use for meaning-based questions (e.g. 'reports " +
      "describing water intrusion' or 'sudden loss of braking') where wording varies. Supports " +
      "optional make/model/year pre-filters. Returns narratives with their odi_id.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        make: { type: "string" },
        model: { type: "string" },
        year_from: { type: "integer" },
        year_to: { type: "integer" },
        limit: { type: "integer" },
      },
      required: ["query"],
    },
  },
];

// ---- execute_sql: the cage ----
export async function executeSql(input: { query: string }): Promise<unknown> {
  const g = guardSql(input.query ?? "", DEFAULT_ROW_LIMIT);
  if (!g.ok) return { error: `Rejected by SQL guard: ${g.error}` };
  try {
    const rows = await sql.begin(async (tx) => {
      // Three independent write-blocks: read-only tx, restricted role, (+ the guard above).
      await tx.unsafe("set transaction read only");
      await tx.unsafe("set local statement_timeout = '5000'");
      await tx.unsafe("set local role agent_readonly");
      return await tx.unsafe(g.sql);
    });
    return { sql_used: g.sql, row_count: rows.length, rows };
  } catch (e) {
    return { sql_used: g.sql, error: String((e as Error)?.message ?? e) };
  }
}

// ---- search_narratives: Voyage embed → pgvector ----
async function voyageEmbed(text: string): Promise<string> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("VOYAGE_API_KEY")}`,
    },
    body: JSON.stringify({ input: [text], model: "voyage-3.5", input_type: "query" }),
  });
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return `[${json.data[0].embedding.join(",")}]`;
}

export async function searchNarratives(input: {
  query: string; make?: string; model?: string; year_from?: number; year_to?: number; limit?: number;
}): Promise<unknown> {
  const k = Math.min(Math.max(input.limit ?? 8, 1), 25);
  try {
    const vec = await voyageEmbed(input.query);

    let where = sql`embedding is not null`;
    if (input.make) {
      where = sql`${where} and make_canonical in (
        select make_canonical from rv_makes
        where make_canonical ilike ${input.make}
           or exists (select 1 from unnest(make_variants) v where v ilike ${input.make}))`;
    }
    if (input.model) where = sql`${where} and model ilike ${"%" + input.model + "%"}`;
    if (input.year_from) where = sql`${where} and model_year >= ${input.year_from}`;
    if (input.year_to) where = sql`${where} and model_year <= ${input.year_to}`;

    const rows = await sql`
      select odi_id, make_canonical, model, model_year, component, failure_mode, severity,
             left(narrative, 600) as narrative,
             round((1 - (embedding <=> ${vec}::vector))::numeric, 3) as similarity
      from complaints
      where ${where}
      order by embedding <=> ${vec}::vector
      limit ${k}`;
    return { hits: rows };
  } catch (e) {
    return { error: String((e as Error)?.message ?? e) };
  }
}
