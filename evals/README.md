# Evals (`/evals`)

Regression guard for the agent (CLAUDE.md §9). A fixture set of hand-verified questions is
run through the **deployed `ask` function** and each answer/provenance is diffed against
expectations. Run it after any change to the system prompt, tools, or schema — it's what
catches the chassis-undercount regression before a user does.

## Run

```bash
npm run eval                    # all fixtures (~3 min; concurrency 3)
npm run eval -- --only chassis  # filter by id/category substring
npm run eval -- --verbose       # print each answer (debugging)
```

Reads `VITE_ASK_FUNCTION_URL` + `VITE_SUPABASE_ANON_KEY` from `.env`. Exit code is non-zero
if any fixture fails (CI-friendly). No dependencies — uses Node's built-in `fetch`.

## What's covered (24 fixtures)

- **recall-count / complaint-count / investigation** — exact counts vs. golden SQL.
- **chassis-coach** — the core trap: "Winnebago Class A in 2024 including chassis" must not
  silently drop chassis recalls; ambiguous "how many Winnebago recalls" must clarify.
- **semantic** — meaning-based queries return relevant narratives (brakes, water intrusion).
- **metric** — affected-units ≠ campaign count; recalls ≠ complaints.
- **grounding** — a made-up make returns "none", not a fabricated number.
- **normalization** — `Itasca` resolves to `WINNEBAGO`; `Coleman` resolves to the make.
- **comparison** — multi-make answers.

## Maintaining the golden values

Expected counts live in `fixtures.ts` and were verified against the live DB. After a data
refresh (e.g. adding makes), re-run `goldens.sql` (Supabase SQL editor / psql / MCP) and
update the `number` values + the "Verified" date in `fixtures.ts`.

## Check kinds (`fixtures.ts`)

- `number` — the value appears in the answer (comma-normalized) + required entity mentions.
- `mention` — `all` present, `any` ≥1 present, `none` absent.
- `narratives` — ≥N narrative hits, optionally of a given `failureMode`.
- `sourcesAny` — provenance includes one of the given ids.

Checks assert *substance*, not exact wording or the agent's tool path, so they're robust to
phrasing while still catching real regressions (wrong numbers, dropped chassis, fabrication).
