# Roadmap — RV Defect Intelligence

Natural-language, retrieval-grounded interface over NHTSA RV defect data. This roadmap is
opinionated and ordered: **Now** is cheap and high-ROI, **Next** items are each roughly a
milestone, **Later** needs accounts/infra. See [`CLAUDE.md`](./CLAUDE.md) for architecture.

## Status (2026-06-19)

All six original milestones are complete and the app is deployed-ready:

- ✅ **Scaffold** — Vite + React + TS + Tailwind; Supabase (Postgres + pgvector); migrations,
  `v_*` views, `agent_readonly` cage, RLS locked down.
- ✅ **Ingestion** — `ingest/01`–`05`: curated make reference (**90 makes**), NHTSA flat-file
  load, RV-slice filter with chassis-vs-coach logic, Claude classification, Voyage embeddings.
  Data: **2,650 recalls · 147 investigations · 14,483 complaints** (classified + embedded).
- ✅ **Agent** — `ask` Edge Function: Claude tool-use loop with `execute_sql` (three-layer
  read-only cage), `search_narratives` (pgvector), `render_chart`; domain rules + grounding.
- ✅ **Frontend** — chat UI, hero, markdown answers, **"How I got this"** provenance panel.
- ✅ **Charts** — recharts bar/line via the `render_chart` tool.
- ✅ **Evals** — `evals/` 24 hand-verified fixtures + dep-free diff runner (`npm run eval`).
- ✅ **Deploy** — `server.mjs` + `railway.json`; pushed to GitHub for Railway.
- ✅ **Trust & Polish** — grounded badge (SQL/semantic/none), Export Sources CSV, auto-open
  provenance, categorized prompts, copy + thumbs feedback (`feedback` table), dark mode.

## Principles

- **Grounded or it doesn't ship.** Every number traces to a tool result; provenance is the
  product, not a nicety.
- **Stay lean.** Tailwind + recharts only; ask before adding dependencies.
- **Evals gate changes.** Run `npm run eval` on any prompt / schema / tool change.
- **No monetization.** This is a focused safety tool, not a product funnel.

---

## Now — Trust & Polish ✅ SHIPPED (2026-06-19)

Done: grounded badge, auto-open + Export Sources CSV, categorized prompts, copy + thumbs
feedback (`feedback` table, anon insert-only), dark mode, mobile padding. Remaining small
nice-to-haves: loading skeletons, fuller ARIA/keyboard nav.

## Next — Features (each ~a milestone)

| Item | Value | Effort | Notes |
|---|---|---|---|
| ✅ **VIN lookup** — `decode_vin` tool (vPIC) + UI VIN box; decodes chassis make/model/year → recalls/complaints, with the coach-not-in-VIN caveat | High | M | Shipped 2026-06-19 |
| ✅ **Weekly auto-refresh** — GitHub Actions runs the idempotent ingest weekly + stamps `app_meta`; the page shows the last-refresh date/counts | High | M | Shipped 2026-06-19 (`.github/workflows/refresh.yml`) |
| ✅ **Streaming responses** — SSE through the function (token deltas + tool status) + live UI render with rotating RV-themed "thinking" messages; JSON mode kept for evals | High | M–L | Shipped 2026-06-19 |
| ✅ **Auto-suggested follow-up chips** — a cheap haiku call returns 2–3 specific next questions (`followups`); rendered as clickable chips under each answer | Med | S | Shipped 2026-06-19 |
| ✅ **Multi-RV comparison** affordance — "⚖️ Compare RVs" button prefills an editable comparison template in the composer | Med | S | Shipped 2026-06-19 |
| ✅ **Chat → Explore deep-links** — answers detect referenced failure modes and render "⌕ Explore in taxonomy" chips that open the Explore tab pre-filtered (`lib/failureModes.ts`) | Med | S | Shipped 2026-06-19 |
| ✅ **RV news feed** — `rv-news` Edge Function aggregates RVBusiness / RV Travel / Google News RSS (dep-free parse, 30-min cache); a "News" tab + sidebar card render headlines | Med | M | Shipped 2026-06-19 |
| ✅ **Component taxonomy browser** — "Explore" tab: failure-mode × severity frequency heatmap + drill-down to top components/makes (anon-readable aggregate views) | Med | M | Shipped 2026-06-19 |

## Later — Needs accounts / infrastructure

- **Supabase Auth** → per-user history, "My RV" saved profiles.
  - ✅ Email + password sign-up / sign-in / sign-out via GoTrue REST (no supabase-js dep),
    session persisted + auto-refreshed; header account control + modal. Shipped 2026-06-21
    (`lib/auth.ts`, `AuthModal.tsx`). **Requires email confirmation OFF in Supabase Auth.**
  - ⬜ Next: per-user chat history + saved VIN/"My RV" profiles (needs a `profiles`/`history`
    table with RLS keyed to `auth.uid()`).
- **Saved searches / watchlists + email alerts** ("new Winnebago Class A recalls 2020–2024")
  via Supabase cron + an Edge Function mailer.
- ✅ **Persistent sidebar dashboard** — recall-trend sparkline, top defect components, top makes;
  each item clicks through to a scoped Ask question. Shipped 2026-06-19 (`Sidebar.tsx`,
  `v_dash_*` views in `0013_dashboard_views.sql`).
- ✅ **Report export** — "Report" button on any answer → branded, print-optimized PDF
  (Markdown + charts + NHTSA-linked sources) via the browser; no new deps. Shipped 2026-06-19.

---

## Explicitly out of scope (for now)

- **Monetization** — white-label, subscriptions, fleet/API tiers. Decided out.
- **UI framework migration** — shadcn/ui, Tremor, Apex. Keep the lean Tailwind + recharts
  stack; revisit only if a concrete need outgrows it.

## Engineering / ops

- **Data refresh workflow:** `npm run ingest:02` (fresh files) → `03` → `04/05 --commit`;
  run `npx tsx ingest/_discover_makes.ts` to surface new unmatched RV brands; then re-run
  `evals/goldens.sql` and update `fixtures.ts`.
- **Eval discipline:** `npm run eval` before/after any agent change; keep the chassis-coach
  fixtures green.
- **Security:** maintain the `agent_readonly` cage, RLS, and server-only secrets. Never put
  Anthropic/Voyage/service-role keys in `VITE_*`.

## Known limitations / tech debt

- `recalls.model`/`model_year` are representative-only; use `v_recall_vehicles` for
  model-year-precise recall counts (the agent already does).
- **TSBs not loaded** — the static zip currently 404s; a Socrata fallback exists but its
  column order differs. Wire up TSB ingest when the source is available.
- ✅ Hero image compressed to responsive webp (`public/img/rv-{768,1536}.webp`, 60/205 KB)
  + crisp logo thumbnail; old 2.6 MB `rv.png` removed. Shipped 2026-06-19.
- `ask` rate limit is **best-effort in-memory** (per warm instance); move to a shared store
  (Postgres/Upstash) if abuse becomes a concern.
- ~0.4% of classifications were off-vocabulary and normalized to `other`.
