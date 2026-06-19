# CLAUDE.md — RV Defect Intelligence (Supabase + LLM natural-language app)

You are building a web app that lets a user ask plain-English questions about NHTSA RV
safety data (recalls, complaints, investigations, TSBs) and get back grounded answers,
charts, and source-cited results. No traditional report builder — the interface is a
chat box. Build incrementally in the milestone order at the bottom. Ask me before
introducing any dependency not listed here.

---

## 1. What we're building

A natural-language interface over NHTSA RV defect data. The user types a question; an
LLM agent decides whether to query structured data (text-to-SQL), search complaint
narratives semantically (vector search), or both; then answers in plain language with
every number traceable to a source (recall campaign ID / NHTSA ODI number).

**Core principle: this is a retrieval-grounded agent, not a fine-tuned model.** Every
statistic in an answer MUST come from a tool result. The model states no number it did
not retrieve. On safety data, an unverifiable answer is a liability.

---

## 2. Tech stack (do not substitute without asking)

- **Frontend:** React + Vite + TypeScript. Tailwind for styling. Keep it a single-page
  chat UI. No state library beyond React hooks.
- **Backend / agent:** Supabase **Edge Functions** (Deno + TypeScript). This is where the
  Anthropic key lives and where the agent loop runs. The browser never sees a key.
- **Database:** Supabase Postgres with the **pgvector** extension.
- **LLM:** Anthropic Messages API, model `claude-sonnet-4-6` for the agent (good
  reasoning at low cost for text-to-SQL). Use tool use / function calling.
- **Embeddings:** Anthropic has no embeddings endpoint. Use **Voyage AI** (Anthropic's
  recommended embeddings provider) — use their current general-purpose model. Store
  vectors in pgvector. (If I'd rather use OpenAI embeddings, ask me; default to Voyage.)
- **Ingestion scripts:** standalone Node/TypeScript scripts in `/ingest`, run manually
  or on a schedule.

---

## 3. Architecture

```
Browser (React chat UI)
   │  POST { question, history }
   ▼
Supabase Edge Function  "ask"   ← holds ANTHROPIC_API_KEY, VOYAGE_API_KEY
   │  agent loop (Claude + tools)
   ├── tool: execute_sql(query)            → read-only Postgres role → gold tables/views
   └── tool: search_narratives(q, filters) → Voyage embed → pgvector similarity search
   │
   ▼  { answer, sources[], sql_used, narrative_hits[] }
Browser renders answer + collapsible "how I got this"
```

The frontend calls ONE endpoint (`ask`). All intelligence is server-side.

---

## 4. Data model

Load only the **RV-filtered slice** into Supabase, not the full national NHTSA dumps.
Keep it lean. Schema (Postgres):

```sql
-- RV reference (built from vPIC + curated brand list)
rv_makes (
  make_canonical text primary key,   -- e.g. 'WINNEBAGO'
  make_variants  text[],             -- raw spellings that map here
  category       text,               -- 'coach' | 'chassis' | 'towable'
  is_motorhome_chassis boolean       -- Ford/Freightliner/Mercedes etc.
)

recalls (
  campaign_id     text primary key,  -- NHTSA recall campaign number
  make_canonical  text references rv_makes,
  model           text,
  model_year      int,
  component       text,
  recall_date     date,
  affected_units  int,
  summary         text,
  consequence     text,
  remedy          text,
  is_chassis      boolean            -- TRUE if filed on the motorhome chassis
)

complaints (
  odi_id          text primary key,  -- NHTSA ODI number
  make_canonical  text references rv_makes,
  model           text,
  model_year      int,
  component       text,
  date_received   date,
  narrative       text,
  -- pre-computed narrative intelligence (see ingestion §5):
  failure_mode    text,              -- extracted/classified at ingest
  severity        text,              -- classified at ingest
  embedding       vector(1024)       -- Voyage; dimension per chosen model
)

investigations (
  odi_action_no   text primary key,
  make_canonical  text references rv_makes,
  component       text,
  open_date       date,
  close_date      date,
  subject         text,
  summary         text
)

tsbs (
  tsb_id          text primary key,
  make_canonical  text references rv_makes,
  model           text,
  model_year      int,
  component       text,
  summary         text
)
```

Add a pgvector index: `create index on complaints using hnsw (embedding vector_cosine_ops);`

Expose **read-only views** (`v_recalls`, `v_complaints`, etc.) that the agent's SQL role
can SELECT. The agent queries views, not base tables.

---

## 5. Ingestion (`/ingest`)

Scripts, run in order:

1. `01_rv_reference.ts` — pull vPIC to map make/model → vehicle type / body class;
   tag the RV universe (coach brands + towables + **motorhome chassis makes**). Seed
   `rv_makes` including the variant→canonical mapping.
2. `02_load_flat_files.ts` — download NHTSA bulk flat files (recalls, complaints,
   investigations, TSBs). They are pipe-delimited with NO header — use the layout `.txt`
   files as the schema. Watch encoding: these are not clean UTF-8; sanitize the
   free-text narrative fields.
3. `03_filter_rv.ts` — inner-join raw records to `rv_makes` to keep only the RV slice.
   Normalize make strings to canonical. Set `recalls.is_chassis`.
4. `04_classify_narratives.ts` — for each complaint, call Claude (`claude-haiku-4-5`)
   once to extract `failure_mode` and `severity` into structured columns. **This is what
   makes "semantic-feeling" questions answerable by plain SQL** — do not skip it.
5. `05_embed_narratives.ts` — embed each complaint narrative via Voyage; store in
   `embedding`. Batch + rate-limit.

Make ingestion idempotent (upsert on primary key) so a daily refresh just diffs.

---

## 6. The agent (Edge Function `ask`)

### System prompt (encode the RV domain rules — this is where accuracy is won)

The system prompt MUST include the database schema AND these domain rules:

- **Make normalization:** brand variants resolve to `make_canonical`. Always query by
  canonical.
- **Chassis vs. coach:** a motorhome's chassis recalls are filed under Ford / Freightliner
  / Mercedes (`is_chassis = true`), separate from the coach brand. When a user asks about
  recalls for a motorhome brand, clarify or include both unless they specify, and never
  silently undercount by ignoring chassis records.
- **Metric definitions:** a "recall" = one campaign (`campaign_id`), NOT one affected
  unit. Recalls ≠ complaints ≠ investigations — different sources and authority. State
  which you used.
- **Grounding:** never state a number you did not get from a tool result. Always cite
  `campaign_id` / `odi_id` so the user can verify against NHTSA.
- **Safety tone:** present findings factually; do not speculate about causes beyond what
  the data shows.

> Note: these rules are the same domain knowledge that would go into a Databricks Genie
> space or a Power BI AI-instructions block. Keep them in one file (`/agent/domain.ts`)
> so they're reusable.

### Tools

```ts
// 1. Structured queries
{
  name: "execute_sql",
  description: "Run ONE read-only SELECT against the RV defect views. Returns JSON rows.",
  input_schema: { type:"object", properties:{ query:{type:"string"} }, required:["query"] }
}

// 2. Semantic search over complaint narratives
{
  name: "search_narratives",
  description: "Semantic search over complaint narratives. Use for meaning-based questions ('reports describing water intrusion'). Supports optional make/model/year pre-filters.",
  input_schema: { type:"object", properties:{
    query:{type:"string"},
    make:{type:"string"}, model:{type:"string"},
    year_from:{type:"integer"}, year_to:{type:"integer"},
    limit:{type:"integer"}
  }, required:["query"] }
}
```

`search_narratives` implementation: embed `query` via Voyage → pgvector cosine search,
applying the metadata filters in the WHERE clause **before** ranking (hybrid retrieval
beats pure vector). Return narratives + their `odi_id`.

### Agent loop (Deno)

```ts
// pseudo-real shape — implement fully
let messages = [...history, { role:"user", content: question }];
while (true) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,         // schema + domain rules + grounding rules
    tools: [executeSqlTool, searchNarrativesTool],
    messages,
  });
  messages.push({ role:"assistant", content: res.content });
  if (res.stop_reason !== "tool_use") break;     // final answer
  const toolResults = await runTools(res.content); // execute each tool_use block
  messages.push({ role:"user", content: toolResults });
}
return finalAnswer(messages); // text + collected sources[] + sql_used
```

Collect every `campaign_id`/`odi_id` and the SQL strings used so the frontend can show
provenance.

---

## 7. Security (do not cut corners here)

1. **API keys** are Edge Function secrets (`supabase secrets set`). Never in the client,
   never in a `VITE_` var.
2. **Dedicated read-only Postgres role** (`agent_readonly`) used only by the Edge
   Function for `execute_sql`: `GRANT SELECT` on the `v_*` views ONLY; no INSERT/UPDATE/
   DELETE, no access to `auth`, `storage`, or base tables. This is the cage — even a
   prompt-injected query physically cannot write.
3. **SQL validation in the Edge Function before execution** (defense in depth): accept a
   single statement only; must start with `SELECT` (or `WITH ... SELECT`); reject
   semicolons beyond the first, comments, and any DDL/DML keyword; reject `pg_`, `information_schema` unless explicitly allowed.
4. **Resource caps:** enforce a `statement_timeout` and inject/append a `LIMIT` (e.g.
   1000) if absent.
5. **No PII concerns** in this dataset, but still rate-limit the `ask` endpoint.

---

## 8. Frontend (React)

- Single chat view: message list + input. Send `{ question, history }` to `ask`.
- Render the assistant's answer (markdown). Below each answer, a collapsible
  **"How I got this"** panel showing: the SQL executed, the source recall/complaint IDs,
  and (if used) the matched narratives. This provenance panel is the trust layer — it's
  what makes a wrong answer *detectable*, which matters on safety data.
- Optional: when a result is a time series or comparison, render a simple chart
  (recharts). Keep it minimal for v1.
- Show a loading state during the (possibly multi-step) agent loop. Streaming is a
  v2 nicety; non-streaming is fine for v1.

---

## 9. Guardrails & evals (`/evals`)

- Build a fixture set of 20–30 questions with **hand-verified answers** (counts you've
  confirmed manually). Include the chassis-vs-coach trap (e.g. "how many recalls on
  Winnebago Class A motorhomes in 2024, including chassis"), a pure-semantic question,
  and a couple of ambiguous ones.
- A script that runs each through `ask` and diffs the answer's key number against the
  expected value. Run it on every change to the system prompt or schema. This is what
  catches the chassis-undercount regression before a user does.

---

## 10. Build order (milestones — stop and confirm after each)

1. **Scaffold** — Vite React app, Supabase project, pgvector enabled, migrations for the
   schema in §4, the `v_*` views, and the `agent_readonly` role. No data yet.
2. **Ingestion** — scripts `01`–`05`. Load a small RV slice end-to-end (start with
   recalls + one make to validate, then widen).
3. **Agent Edge Function** — `ask` with both tools, the system prompt + domain rules,
   the agent loop, and all of §7's guardrails. Test with curl before any UI.
4. **Frontend** — chat UI calling `ask`, with the "How I got this" provenance panel.
5. **Charts** — minimal recharts for time-series/comparison answers.
6. **Evals** — the fixture set + diff runner.

---

## 11. Environment variables

```
# Edge Function secrets (server-side only)
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=        # ingestion only, never shipped to client
AGENT_DB_URL=                     # connection string for the read-only agent_readonly role

# Frontend (public, safe)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ASK_FUNCTION_URL=
```
