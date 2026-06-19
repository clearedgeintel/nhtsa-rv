# RV Defect Intelligence

A natural-language interface over NHTSA RV defect data (recalls, complaints,
investigations, TSBs). Ask plain-English questions; an LLM agent queries structured data
(text-to-SQL) and/or searches complaint narratives semantically (pgvector), then answers
with every number traceable to a source (recall campaign ID / NHTSA ODI number).

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture and build plan.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind (single-page chat UI)
- **Backend / agent:** Supabase Edge Functions (Deno) — holds the Anthropic & Voyage keys
- **Database:** Supabase Postgres + pgvector
- **LLM:** Anthropic `claude-sonnet-4-6` (agent), `claude-haiku-4-5` (ingest classification)
- **Embeddings:** Voyage AI

## Status — Milestone 1 (scaffold) complete

- [x] Vite React + Tailwind frontend (placeholder chat shell)
- [x] Supabase project `nhtsa-rv` with pgvector
- [x] Schema migration (`supabase/migrations/0001_schema.sql`)
- [x] Read-only `v_*` views (`0002_views.sql`)
- [x] `agent_readonly` role + grants (`0003_agent_readonly_role.sql`)
- [ ] Milestone 2 — ingestion (`/ingest`)
- [ ] Milestone 3 — agent Edge Function (`ask`)
- [ ] Milestone 4 — chat UI + provenance panel
- [ ] Milestone 5 — charts
- [ ] Milestone 6 — evals

## Local development

```bash
npm install
npm run dev      # serve the chat UI
npm run build    # typecheck + production build
```

## Database

Migrations live in `supabase/migrations/` and are applied to the remote `nhtsa-rv`
project. The agent's SQL tool connects via a dedicated read-only role (`agent_readonly`)
that can `SELECT` only the `v_*` views — see [`CLAUDE.md`](./CLAUDE.md) §7.

Set up environment variables by copying `.env.example` to `.env`.
