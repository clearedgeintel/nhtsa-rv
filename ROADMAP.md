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

## Principles

- **Grounded or it doesn't ship.** Every number traces to a tool result; provenance is the
  product, not a nicety.
- **Stay lean.** Tailwind + recharts only; ask before adding dependencies.
- **Evals gate changes.** Run `npm run eval` on any prompt / schema / tool change.
- **No monetization.** This is a focused safety tool, not a product funnel.

---

## Now — Trust & Polish (no new deps, ~1 day total)

The highest-leverage batch for a safety-data tool. None of these need new dependencies.

| Item | Value | Effort | Touches |
|---|---|---|---|
| **Grounded indicator** — green when numbers come from `execute_sql`, amber when semantic-only | High | S | `Provenance.tsx`, answer metadata |
| **Auto-open provenance** when sources are large / answer is numeric | Med | S | `Provenance.tsx` |
| **Export Sources CSV** — campaign_ids/odi_ids with direct NHTSA links | High | S | `Provenance.tsx` |
| **Categorized example prompts** (Recalls / Complaints / Trends / Chassis) | Med | S | `App.tsx` |
| **Copy answer** + **thumbs up/down** → log to a `feedback` table (feeds evals) | Med | S | `App.tsx`, one migration |
| **Mobile polish** (padding, sticky composer) + **dark mode** | Med | S–M | `App.tsx`, Tailwind config |
| **Loading skeletons**, ARIA labels, keyboard nav | Med | S | `App.tsx` |

## Next — Features (each ~a milestone)

| Item | Value | Effort | Notes |
|---|---|---|---|
| **VIN lookup** — decode VIN (vPIC) → make/model/year → that vehicle's recalls/complaints | High | M | New NHTSA API calls; a tool or a pre-step before the agent |
| **Weekly auto-refresh** — Supabase cron delta ingest | High | M | Ingest is already idempotent; add scheduled job + `_discover_makes` review |
| **Streaming responses** (SSE through the Edge Function + frontend) | High | M–L | Big perceived-latency win on multi-step loops |
| **Auto-suggested follow-up chips** ("show chart", "filter 2023–2025") | Med | S | Agent returns 2–3 suggestions in the response |
| **Multi-RV comparison** affordance | Med | S | Already works via the agent; add a UI entry point + example |
| **Component taxonomy browser** — failure_mode/component frequency heatmaps | Med | M | New read-only view + a simple browse UI |

## Later — Needs accounts / infrastructure

- **Supabase Auth** → per-user history, "My RV" saved profiles.
- **Saved searches / watchlists + email alerts** ("new Winnebago Class A recalls 2020–2024")
  via Supabase cron + an Edge Function mailer.
- **Persistent sidebar dashboard** — top defect components, recall trend sparkline, top makes.
- **Report export** — formatted Markdown → PDF for owners/dealers.

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
- Hero image (`public/rv.png`, ~2.7 MB) should be compressed/responsive.
- `ask` rate limit is **best-effort in-memory** (per warm instance); move to a shared store
  (Postgres/Upstash) if abuse becomes a concern.
- ~0.4% of classifications were off-vocabulary and normalized to `other`.
