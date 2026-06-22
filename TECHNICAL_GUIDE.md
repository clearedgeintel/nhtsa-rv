# RV Defect Intelligence — Technical Guide

A natural-language, **retrieval-grounded** interface over NHTSA RV safety data (recalls,
complaints, investigations, TSBs). Users ask plain-English questions; an LLM agent decides
whether to query structured data (text-to-SQL), search complaint narratives semantically
(pgvector), or both — then answers in plain language with **every number traceable to a
source** (recall campaign ID / NHTSA ODI number).

> **Core principle:** this is a retrieval-grounded agent, not a fine-tuned model. Every
> statistic in an answer comes from a tool result. The model states no number it did not
> retrieve. On safety data, an unverifiable answer is a liability.

---

## 1. Architecture

```
Browser (React + Vite SPA)
   │
   ├── POST /functions/v1/ask        { question, history, stream? }
   │      Edge Function "ask"  ← holds ANTHROPIC_API_KEY, VOYAGE_API_KEY
   │        agent loop (Claude + tools)
   │          ├── execute_sql(query)            → read-only Postgres role → v_* views
   │          ├── search_narratives(q, filters) → Voyage embed → pgvector similarity
   │          ├── render_chart(spec)            → chart spec for the UI
   │          └── decode_vin(vin)               → vPIC chassis decode
   │      → { answer, sources[], sql_used[], narrative_hits[], charts[], followups[] }
   │
   ├── GET  /functions/v1/rv-news     → server-side RSS aggregator (RV industry news)
   │
   └── GET  /rest/v1/...              PostgREST (anon key) for read-only aggregates,
          /auth/v1/...                GoTrue auth, and per-user tables (RLS by auth.uid())
```

The browser **never holds an LLM key**. All model/tool intelligence is server-side in the
`ask` Edge Function. Everything else the browser does is plain PostgREST/Auth reads scoped
by Postgres grants + RLS.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript**, **Tailwind** | Single-page app, React hooks only (no state lib) |
| Charts | **recharts** | Rendered from the agent's `render_chart` tool output |
| Markdown | `react-markdown` + `remark-gfm` | Renders assistant answers |
| Backend / agent | **Supabase Edge Functions** (Deno + TS) | Holds secrets, runs the agent loop |
| Database | **Supabase Postgres + pgvector** | RV-filtered slice only, not full national dumps |
| LLM | **Anthropic Messages API** — `claude-sonnet-4-6` (agent), `claude-haiku-4-5` (classify/follow-ups) | Tool use / function calling |
| Embeddings | **Voyage AI** (`voyage-3.5`, 1024-dim) | Anthropic has no embeddings endpoint |
| Ingestion | Standalone **Node/TS** scripts in `/ingest` (run via `tsx`) | Idempotent upserts |
| Hosting | Static SPA served by `server.mjs` on **Railway**; Edge Functions on Supabase | |

**Dependency policy:** keep it lean (Tailwind + recharts). Ask before adding any runtime
dependency. Build-time-only image conversion was done with a transient `npx sharp-cli` (no
entry in `package.json`).

---

## 3. Repository layout

```
.
├── index.html                 # SPA shell (+ PWA manifest/theme-color links)
├── server.mjs                 # zero-dep static file server for dist/ (Railway)
├── railway.json               # Railway build/start config
├── src/                       # frontend
│   ├── App.tsx                # top-level: tabs (Ask/Explore/News/Data), header, composer
│   ├── api.ts                 # ask (SSE + JSON), dashboard, explore, feedback, grounding
│   ├── types.ts               # shared TS types
│   ├── components/
│   │   ├── AssistantMessage.tsx  # answer bubble: grounding badge, actions, chips
│   │   ├── Provenance.tsx        # "How I got this" panel (SQL/sources/narratives)
│   │   ├── Chart.tsx             # recharts bar/line
│   │   ├── Markdown.tsx          # markdown renderer
│   │   ├── TaxonomyBrowser.tsx   # Explore tab: heatmap + drill-down + slicers
│   │   ├── DataBrowser.tsx       # Data tab: spreadsheet over v_* views
│   │   ├── NewsFeed.tsx          # News tab + sidebar news card
│   │   ├── Sidebar.tsx           # persistent interactive dashboard
│   │   ├── AccountPanel.tsx      # per-user History / My RVs / Saved
│   │   ├── AuthModal.tsx         # email/password sign in/up
│   │   └── ReportView.tsx        # print-to-PDF report
│   └── lib/
│       ├── auth.ts            # GoTrue REST auth + session store (useAuthUser)
│       ├── userData.ts        # token-authed CRUD for per-user tables
│       ├── rawData.ts         # Data tab: paged/sorted/filtered PostgREST + CSV
│       ├── failureModes.ts    # detect failure modes in answers → Explore deep-links
│       └── thinkingMessages.ts# rotating "thinking" phrases while streaming
├── supabase/
│   ├── migrations/            # 0001–0016 (schema, views, cage, RLS, features)
│   └── functions/
│       ├── ask/               # the agent (index.ts, domain.ts, tools.ts, sql_guard.ts)
│       └── rv-news/           # RSS aggregator
├── ingest/                    # 01–06 pipeline + helpers + data/
└── evals/                     # fixtures.ts, run.ts, goldens.sql
```

---

## 4. Data model

Only the **RV-filtered slice** is loaded (coach brands + towables + motorhome **chassis**
makes). Base tables (`0001_schema.sql`):

- `rv_makes(make_canonical PK, make_variants[], category, is_motorhome_chassis)`
- `recalls(campaign_id PK, make_canonical, model, model_year, component, recall_date, affected_units, summary, consequence, remedy, is_chassis)`
- `complaints(odi_id PK, make_canonical, model, model_year, component, date_received, narrative, failure_mode, severity, embedding vector(1024))`
- `investigations(odi_action_no PK, make_canonical, component, open_date, close_date, subject, summary)`
- `tsbs(tsb_id PK, make_canonical, model, model_year, component, summary)`

pgvector index: `create index on complaints using hnsw (embedding vector_cosine_ops);`

**Read-only views** (`0002_views.sql`) are what the agent and the public read — never base
tables: `v_rv_makes`, `v_recalls`, `v_complaints`, `v_investigations`, `v_tsbs`. These are
**default** Postgres views (security_invoker OFF), so they read base tables with the view
**owner's** rights; the `embedding` vector is intentionally excluded. `v_recall_vehicles`
(`0004`) gives model-year-precise recall counts.

### Migration history

| # | Purpose |
|---|---|
| 0001 | Base schema + pgvector |
| 0002 | `v_*` read-only views |
| 0003 | `agent_readonly` role |
| 0004 | `v_recall_vehicles` (model-year precise) |
| 0005 | Enable RLS |
| 0006 | Revoke default public grants |
| 0007 | Grant agent role to postgres |
| 0008 | `feedback` table (anon insert-only thumbs) |
| 0009 | `app_meta` (data-refresh status) |
| 0010 | Taxonomy aggregate views (Explore heatmap) |
| 0011 | Taxonomy slicer RPCs (brand/year filters) |
| 0012 | `rpc_failure_mode_details` (complaints behind a number) |
| 0013 | Dashboard views (sidebar) |
| 0014 | `rpc_dashboard(p_make)` (interactive sidebar) |
| 0015 | Per-user tables + owner RLS (`chat_history`, `rv_profiles`, `saved_searches`) |
| 0016 | Grant anon/authenticated SELECT on `v_*` (raw Data tab) |

---

## 5. Ingestion pipeline (`/ingest`)

Run in order (each is idempotent — upsert on PK, so a refresh just diffs):

| Script | npm | What it does |
|---|---|---|
| `01_rv_reference.ts` | `ingest:01` | Pull vPIC → map make/model to vehicle type/body class; seed `rv_makes` (90 makes) incl. variant→canonical mapping and chassis makes |
| `02_load_flat_files.ts` | `ingest:02` | Download NHTSA bulk flat files (pipe-delimited, no header; layout `.txt` is the schema). Sanitizes non-UTF-8 narrative fields |
| `03_filter_rv.ts` | `ingest:03` | Inner-join raw records to `rv_makes` → RV slice; normalize make strings; set `recalls.is_chassis` |
| `04_classify_narratives.ts` | `ingest:04` | One `claude-haiku-4-5` call per complaint → structured `failure_mode` + `severity` (this is what makes "semantic-feeling" questions answerable by plain SQL) |
| `05_embed_narratives.ts` | `ingest:05` | Embed each narrative via Voyage → `embedding`. Batched + rate-limited |
| `06_stamp_refresh.ts` | `ingest:stamp` | Write counts + timestamp to `app_meta` for the header |

Helpers: `_discover_makes.ts` (surface new unmatched RV brands), `_smoketest.ts`.

**Current data:** ~2,650 recalls · 147 investigations · 14,483 complaints (classified +
embedded). **TSBs not loaded** — the static zip currently 404s.

**Refresh workflow:** `ingest:02` (fresh files) → `03` → `04`/`05` (`--commit`) →
`ingest:stamp`; a weekly GitHub Action (`.github/workflows/refresh.yml`) runs it and
stamps `app_meta`. Re-run `evals/goldens.sql` + update `fixtures.ts` after big changes.

---

## 6. The agent — Edge Function `ask`

`supabase/functions/ask/` — `index.ts` (loop + SSE), `domain.ts` (system prompt + RV
domain rules), `tools.ts` (tool implementations), `sql_guard.ts` (+ `.test.ts`).

**Model:** `claude-sonnet-4-6`, `MAX_STEPS = 8`.

### Tools

| Tool | Purpose |
|---|---|
| `execute_sql(query)` | One read-only `SELECT` against the `v_*` views → JSON rows |
| `search_narratives(query, make?, model?, year_from?, year_to?, limit?)` | Voyage-embed the query → pgvector cosine search, **metadata filters applied before ranking** (hybrid retrieval) |
| `render_chart(spec)` | Returns a chart spec (bar/line) the UI renders with recharts |
| `decode_vin(vin)` | vPIC decode of the chassis make/model/year (coach not in VIN — caveated) |

### System prompt / domain rules (`domain.ts`)

Encodes the schema **and** the RV domain rules where accuracy is won:

- **Make normalization** — brand variants resolve to `make_canonical`; always query canonical.
- **Chassis vs. coach** — a motorhome's chassis recalls are filed under Ford/Freightliner/
  Mercedes (`is_chassis = true`), separate from the coach brand. Never silently undercount
  by ignoring chassis records; clarify or include both.
- **Metric definitions** — a "recall" = one campaign (`campaign_id`), not one affected unit.
  Recalls ≠ complaints ≠ investigations; state which source was used.
- **Grounding** — never state a number not from a tool result; always cite `campaign_id` /
  `odi_id`.
- **Safety tone** — present findings factually; don't speculate beyond the data.

### Loop

```ts
let messages = [...history, { role: "user", content: question }];
while (true) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 2048,
    system: SYSTEM_PROMPT, tools: [...], messages,
  });
  messages.push({ role: "assistant", content: res.content });
  if (res.stop_reason !== "tool_use") break;
  messages.push({ role: "user", content: await runTools(res.content) });
}
```

Every `campaign_id`/`odi_id` and SQL string is collected for the response so the UI can
show provenance. A cheap haiku call generates 2–3 follow-up questions.

### Response modes

- **JSON** (default; used by curl + evals): `{ answer, sources[], sql_used[], narrative_hits[], charts[], followups[] }`
- **SSE** (when `stream: true`): `data: {type:"text"|"status"|"done"|"error", ...}` — token
  deltas + tool-status labels; the browser renders live with rotating "thinking" phrases.

---

## 7. Security model

Defense in depth — even a prompt-injected query physically cannot write or read PII:

1. **Secrets** are Edge Function secrets (`supabase secrets set`). Never in the client,
   never in a `VITE_` var. `SUPABASE_SERVICE_ROLE_KEY` is ingestion-only.
2. **The cage — a dedicated read-only role.** `agent_readonly` (`0003`) is granted SELECT on
   the `v_*` views **only** — no base tables, no `auth`/`storage`, no INSERT/UPDATE/DELETE.
   The `execute_sql` tool connects as this role. Because the views are default (owner-rights)
   views, the role never needs base-table privileges. RLS is enabled (`0005`) and default
   public grants revoked (`0006`).
3. **SQL validation before execution** (`sql_guard.ts`): single statement only; must start
   with `SELECT` (or `WITH … SELECT`); rejects extra semicolons, comments, DDL/DML keywords,
   and `pg_`/`information_schema`; appends a `LIMIT` if absent and enforces `statement_timeout`.
4. **Rate-limit** on `ask` (best-effort in-memory, per warm instance).
5. **Per-user data** (`0015`) is owner-only via RLS keyed to `auth.uid()`; the anon role has
   no grant. The public Data tab (`0016`) exposes only the `v_*` views (public NHTSA data,
   embeddings excluded) — a separate path that does not touch the cage.

---

## 8. Authentication & per-user data

**Auth** (`src/lib/auth.ts`) — email + password via Supabase **GoTrue REST** (no
`supabase-js` in the client): `signUp`/`signIn`/`signOut`, session (access + refresh tokens)
persisted to `localStorage`, auto-refreshed within 60s of expiry, exposed via
`useAuthUser()` (a `useSyncExternalStore` hook). `AuthModal.tsx` is the sign-in/up UI; the
header shows the email (opens the account panel) + Sign out.

> **Requires "Confirm email" OFF** in Supabase Auth so sign-up returns a session
> immediately. (Confirmed off on this project.)

**Per-user tables** (`0015`, owner-only RLS): `chat_history`, `rv_profiles`,
`saved_searches`. `user_id` defaults to `auth.uid()`; a single `FOR ALL` policy restricts
every op to the owner. `src/lib/userData.ts` is the token-authed PostgREST client (never
sends `user_id` — the default + RLS handle it). `AccountPanel.tsx` is a slide-over with
**History** (auto-saved answers; reopen without re-querying), **My RVs** (saved profiles →
scoped questions), and **Saved** searches (the answer toolbar's "☆ Save").

---

## 9. Frontend

Four tabs in `App.tsx`, deep-linkable via `?view=`:

- **Ask** — chat. Streaming answers; each `AssistantMessage` has a grounding badge
  (`▦ SQL · ◆ Hybrid · ≈ Semantic · ○ Ungrounded`), an actions toolbar (Copy · Share ·
  Regenerate · Report · ☆ Save · 👍/👎), a **Provenance** panel ("How I got this": SQL,
  sources with NHTSA links, matched narratives; CSV + copy-as-Markdown), follow-up chips,
  and **"⌕ Explore in taxonomy"** deep-link chips (failure modes detected in the answer).
- **Explore** — `TaxonomyBrowser`: failure-mode × severity **heatmap** (keyboard-navigable
  grid), brand/model-year/received-year **slicers**, drill-down to top components/makes, and
  **click any number** to see the underlying complaints. Export CSV + shareable URL state.
- **News** — `NewsFeed`: RV industry headlines from the `rv-news` function.
- **Data** — `DataBrowser`: spreadsheet over the `v_*` views with sort, search, pagination,
  and CSV export.

**Persistent sidebar** (`Sidebar.tsx`, desktop): recall-trend sparkline + top components +
top makes; **click a make to re-scope** the trend/components (interactive `rpc_dashboard`);
a "Latest RV news" card. Plus dark mode, PWA (installable, offline shell via `public/sw.js`),
responsive webp hero, and a print-to-PDF report (`ReportView.tsx`).

`src/api.ts` holds the client calls: `askAgentStream` (SSE), `askAgent` (JSON, for evals),
dashboard/explore/news fetches, `groundingOf`, and `submitFeedback`.

---

## 10. The `rv-news` Edge Function

`GET /functions/v1/rv-news` — fetches a curated set of RV-industry RSS feeds (RVBusiness,
RV Travel, Google News) server-side (the browser can't, due to CORS), parses RSS 2.0 + Atom
with a **dependency-free** parser, dedupes, sorts by date, caches in-memory ~30 min, and
returns `{ items, fetched_at }`. The frontend derives the URL from `SUPABASE_URL` (no extra
env var).

---

## 11. Environment variables

```bash
# Edge Function secrets (server-side only)
ANTHROPIC_API_KEY=
VOYAGE_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=     # ingestion only, never shipped to client
AGENT_DB_URL=                  # connection string for the read-only agent_readonly role

# Frontend (public, safe)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ASK_FUNCTION_URL=
```

The `rv-news` URL and PostgREST/Auth base are derived from `VITE_SUPABASE_URL`.

---

## 12. Local dev, build & deploy

```bash
npm install
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build  → dist/
npm run preview    # preview the production build
npm start          # node server.mjs (serves dist/ on $PORT) — Railway start command
```

- **Frontend** deploys to **Railway** (`server.mjs` + `railway.json`); push to `master`
  triggers the deploy. `server.mjs` is a zero-dependency static server: long-cache for
  content-hashed assets, `no-cache` for the HTML shell, `sw.js`, and the manifest.
- **Edge Functions** deploy to Supabase (`supabase functions deploy ask` / `rv-news`, or via
  the management API). `ask` requires its secrets set; both use `verify_jwt: true` (the
  browser sends the anon key).
- **Migrations** live in `supabase/migrations/` and apply to the linked project.

---

## 13. Evals (`/evals`)

`fixtures.ts` holds 24+ hand-verified Q→expected-number fixtures (incl. the chassis-vs-coach
trap, a pure-semantic question, and ambiguous ones). `run.ts` (`npm run eval`) sends each
through `ask` (JSON mode) and diffs the key number against expected. `goldens.sql` is the
source of truth for the expected values.

**Eval discipline:** run `npm run eval` before/after any change to the system prompt,
schema, or tools — it catches the chassis-undercount regression before a user does.

---

## 14. Extending the app

- **New agent capability** → add a tool in `tools.ts` + its schema in the tool list in
  `index.ts`; update `domain.ts` if it introduces a new metric/rule; add an eval fixture.
- **New aggregate for the UI** → a view or `SECURITY DEFINER` RPC (counts-only, anon-safe),
  grant to `anon`, fetch via PostgREST in `api.ts`. Follow the `0010`–`0014` pattern.
- **New per-user feature** → a table with `user_id default auth.uid()` + a `FOR ALL` RLS
  policy + grant to `authenticated`; CRUD via `lib/userData.ts` (token-authed). Follow `0015`.
- **New tab** → add to the `view` union + tab list in `App.tsx`; it deep-links via `?view=`.

---

## 15. Known limitations / tech debt

- **TSBs not loaded** — the static NHTSA zip 404s; a Socrata fallback exists but its column
  order differs. The `tsbs` table + Data tab are wired and will populate when the source is
  available.
- `recalls.model`/`model_year` are representative-only; use `v_recall_vehicles` for
  model-year-precise recall counts (the agent already does).
- `ask` rate limit is best-effort in-memory (per warm instance); move to a shared store
  (Postgres/Upstash) if abuse becomes a concern.
- ~0.4% of complaint classifications were off-vocabulary and normalized to `other`.
- **Email alerts** for saved searches are not built yet (would need a Supabase cron diff +
  an Edge Function mailer).
- The public **Data tab** makes the full RV slice browsable/downloadable (public NHTSA data
  by design); gate behind auth if that changes.

---

*See [`CLAUDE.md`](./CLAUDE.md) for the original build spec and [`ROADMAP.md`](./ROADMAP.md)
for shipped/planned features.*
