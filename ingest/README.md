# Ingestion (`/ingest`)

Loads the **RV-filtered slice** of NHTSA ODI data into Supabase. Scripts are idempotent
(upsert on primary key) so a re-run just diffs. Run them in order.

## Prerequisites

`.env` (gitignored) must contain:

| Var | Used by | Why |
|-----|---------|-----|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | 01–05 | write the RV slice (bypasses RLS) |
| `ANTHROPIC_API_KEY` | 04 | classify narratives (`claude-haiku-4-5`) |
| `VOYAGE_API_KEY` | 05 | embed narratives (`voyage-3.5`, 1024-dim) |

## Run order

```bash
npm run ingest:01                      # seed rv_makes (curated + vPIC enrichment)
npm run ingest:02                      # download + extract NHTSA flat files → ingest/.data
npm run ingest:03                      # filter to RV slice, normalize, load base tables
npm run ingest:04                      # DRY RUN: count + cost estimate
npm run ingest:04 -- --commit          # classify failure_mode + severity
npm run ingest:05                      # DRY RUN: count + cost estimate
npm run ingest:05 -- --commit          # embed narratives → pgvector
```

Limit scope while validating:

```bash
npm run ingest:02 -- recalls investigations    # only these datasets
npm run ingest:03 -- recalls                    # load just recalls first
npm run ingest:04 -- --commit --limit 200       # classify a sample
```

## What each script does

1. **`01_rv_reference.ts`** — seeds `rv_makes` from the curated list in
   `data/rv_makes_seed.ts` (variant→canonical mappings), enriched with vPIC
   motorhome/trailer makes. Source of truth for make normalization.
2. **`02_load_flat_files.ts`** — downloads the ODI bulk flat files (tab-delimited, no
   header; Windows-1252) to `ingest/.data/` and extracts them. No DB writes — staging is
   on disk so the DB only ever holds the RV slice. TSBs are optional (Socrata fallback).
3. **`03_filter_rv.ts`** — streams each file, resolves make→canonical, drops non-RV
   records, and upserts the slice. **Chassis handling (§6):** coach/towable brands qualify
   by make; mass-market chassis makes (Ford, Chevrolet, Ram, Mercedes, Freightliner,
   International) are kept only when the model looks like a motorhome chassis; Spartan and
   Workhorse always qualify. Sets `recalls.is_chassis`.
4. **`04_classify_narratives.ts`** — one `claude-haiku-4-5` call per complaint (forced
   structured tool) → `failure_mode`, `severity`. **Dry-run by default; `--commit` to run.**
5. **`05_embed_narratives.ts`** — Voyage `voyage-3.5` embeddings → `complaints.embedding`.
   **Dry-run by default; `--commit` to run.**

## Notes / known limitations

- The flat files are **tab-delimited** (CLAUDE.md §5 says "pipe" — the real files use tabs;
  handled correctly here).
- `recalls.campaign_id` is the PK, so the per-(campaign,make,model,year) rows in the source
  collapse to **one row per campaign** (matches "a recall = one campaign", §6). The
  representative `model`/`model_year` is the first row seen — campaign-level fields
  (summary/consequence/remedy) are identical across rows. If model-year-precise recall
  filtering is needed, add a `recall_vehicles` child table (proposed follow-up).
- `_smoketest.ts` validates parsing/matching offline (no keys): `npx tsx ingest/_smoketest.ts`.
