// 03_filter_rv.ts — keep only the RV slice and load it (CLAUDE.md §5.3).
// Streams each staged flat file, resolves make→canonical, drops non-RV records, sets
// recalls.is_chassis, and upserts into the base tables. Idempotent (upsert on PK).
//
// Chassis nuance (§6): coach/towable brands build only RVs, so the make alone qualifies.
// Mass-market chassis makes (Ford, Chevrolet, Ram, Mercedes, Freightliner, International)
// build mostly non-RV vehicles — include them ONLY when the model looks like a motorhome
// chassis. RV-dedicated chassis (Spartan, Workhorse) always qualify.
//
// Run: npm run ingest:03            (all datasets)
//      npm run ingest:03 -- recalls investigations

import { db, upsertBatched } from "./lib/db.ts";
import { MakeMatcher, type MakeRow, type MakeEntry } from "./lib/makes.ts";
import { streamRecords, parseDate, parseYear, parseInt0, clean } from "./lib/nhtsa.ts";
import { DATA_DIR } from "./lib/env.ts";
import { resolveDataFile, type SourceKey } from "./lib/sources.ts";

const RV_DEDICATED_CHASSIS = new Set(["SPARTAN", "WORKHORSE", "PREVOST"]);
const MOTORHOME_MODEL_RE =
  /MOTOR\s?HOME|CHASSIS|STRIPPED|\bF-?5[39]\b|SPRINTER|\bRV\b|RECREATION|MOTOR COACH/i;

/** Does this matched record belong to the RV universe? (Handles the chassis case.) */
function rvQualifies(entry: MakeEntry, model: string | null): boolean {
  if (!entry.isChassis) return true; // coach / towable brand → always RV
  if (RV_DEDICATED_CHASSIS.has(entry.canonical)) return true;
  return MOTORHOME_MODEL_RE.test(model ?? "");
}

async function loadMatcher(): Promise<MakeMatcher> {
  const { data, error } = await db()
    .from("rv_makes")
    .select("make_canonical, make_variants, category, is_motorhome_chassis");
  if (error) throw new Error(`load rv_makes failed: ${error.message}`);
  if (!data?.length) throw new Error("rv_makes is empty — run 01_rv_reference first");
  return new MakeMatcher(data as MakeRow[]);
}

/** Generic streaming filter+load for one dataset. */
async function loadDataset(
  key: SourceKey,
  matcher: MakeMatcher,
  table: string,
  pk: string,
  mapRow: (f: string[], m: MakeEntry) => Record<string, unknown> | null,
  rawMakeIdx: number,
  rawModelIdx: number,
) {
  const file = await resolveDataFile(DATA_DIR, key);
  if (!file) {
    console.warn(`[${key}] no staged file — run 02_load_flat_files; skipping`);
    return;
  }
  if (/\.tsv$/i.test(file)) {
    console.warn(`[${key}] only the Socrata fallback (.tsv) is present; its column order differs from the flat file — skipping. Re-run 02 once the zip is available.`);
    return;
  }
  console.log(`[${key}] reading ${file}`);

  const seen = new Set<string>();
  const unmatched = new Map<string, number>(); // raw make → count (for empirical refinement)
  let buffer: Record<string, unknown>[] = [];
  let matched = 0, kept = 0, total = 0;

  const flush = async () => {
    if (!buffer.length) return;
    await upsertBatched(table, buffer, pk, 500);
    buffer = [];
  };

  total = await streamRecords(file, async (f) => {
    const entry = matcher.match(f[rawMakeIdx]);
    if (!entry) {
      const raw = (f[rawMakeIdx] ?? "").trim().toUpperCase();
      if (raw) unmatched.set(raw, (unmatched.get(raw) ?? 0) + 1);
      return;
    }
    matched++;
    const model = clean(f[rawModelIdx]);
    if (!rvQualifies(entry, model)) return;
    const row = mapRow(f, entry);
    if (!row) return;
    const id = String(row[pk]);
    if (!id || seen.has(id)) return; // dedupe PK across the stream
    seen.add(id);
    buffer.push(row);
    kept++;
    if (buffer.length >= 1000) await flush();
  });
  await flush();

  console.log(`[${key}] scanned ${total} rows → ${matched} RV-make matches → ${kept} unique ${table} loaded`);
  // Surface high-frequency unmatched makes — these are candidates to add to the curated
  // seed if any are RV brands we missed.
  const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (top.length) {
    console.log(`[${key}] top unmatched makes (refine rv_makes_seed if any are RV):`);
    for (const [mk, c] of top) console.log(`    ${String(c).padStart(7)}  ${mk}`);
  }
}

/**
 * Recalls need two tables: campaign-level `recalls` (one row per campaign_id) and the
 * `recall_vehicles` child (one row per campaign×make×model×year, for model-year-precise
 * queries). Accumulate fully, then upsert recalls (FK parent) before recall_vehicles.
 * RCL fields: 2 CAMPNO,3 MAKETXT,4 MODELTXT,5 YEARTXT,7 COMPNAME,12 POTAFF,16 RCDATE,20 DESC,21 CONSEQ,22 CORRECTIVE
 */
async function loadRecalls(matcher: MakeMatcher) {
  const file = await resolveDataFile(DATA_DIR, "recalls");
  if (!file) {
    console.warn(`[recalls] no staged file — run 02_load_flat_files; skipping`);
    return;
  }
  console.log(`[recalls] reading ${file}`);

  const campaigns = new Map<string, Record<string, unknown>>(); // campaign_id → row (first wins)
  const vehicles = new Map<string, Record<string, unknown>>(); // rv_id → row
  const unmatched = new Map<string, number>();
  let matched = 0;

  const total = await streamRecords(file, (f) => {
    const entry = matcher.match(f[2]);
    if (!entry) {
      const raw = (f[2] ?? "").trim().toUpperCase();
      if (raw) unmatched.set(raw, (unmatched.get(raw) ?? 0) + 1);
      return;
    }
    matched++;
    const model = clean(f[3]);
    if (!rvQualifies(entry, model)) return;
    const campaign_id = clean(f[1]);
    if (!campaign_id) return;
    const model_year = parseYear(f[4]);

    if (!campaigns.has(campaign_id)) {
      campaigns.set(campaign_id, {
        campaign_id,
        make_canonical: entry.canonical,
        model,
        model_year,
        component: clean(f[6]),
        recall_date: parseDate(f[15]),
        affected_units: parseInt0(f[11]),
        summary: clean(f[19]),
        consequence: clean(f[20]),
        remedy: clean(f[21]),
        is_chassis: entry.isChassis,
      });
    }
    const rv_id = `${campaign_id}|${entry.canonical}|${model ?? ""}|${model_year ?? ""}`;
    if (!vehicles.has(rv_id)) {
      vehicles.set(rv_id, {
        rv_id, campaign_id, make_canonical: entry.canonical, model, model_year,
        is_chassis: entry.isChassis,
      });
    }
  });

  await upsertBatched("recalls", [...campaigns.values()], "campaign_id", 500);
  await upsertBatched("recall_vehicles", [...vehicles.values()], "rv_id", 500);

  console.log(
    `[recalls] scanned ${total} → ${matched} RV-make matches → ${campaigns.size} campaigns, ${vehicles.size} vehicle rows`,
  );
  const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  if (top.length) {
    console.log(`[recalls] top unmatched makes (refine rv_makes_seed if any are RV):`);
    for (const [mk, c] of top) console.log(`    ${String(c).padStart(7)}  ${mk}`);
  }
}

// ---- Field index maps (0-based; see flat-file layouts) ----

async function main() {
  const matcher = await loadMatcher();
  const argv = process.argv.slice(2) as SourceKey[];
  const keys = argv.length ? argv : (["recalls", "complaints", "investigations", "tsbs"] as SourceKey[]);

  for (const key of keys) {
    if (key === "recalls") {
      await loadRecalls(matcher);
    } else if (key === "complaints") {
      // CMPL fields: 2 ODINO,4 MAKETXT,5 MODELTXT,6 YEARTXT,12 COMPDESC,17 LDATE,20 CDESCR
      await loadDataset(
        "complaints", matcher, "complaints", "odi_id",
        (f, m) => {
          const odi_id = clean(f[1]);
          if (!odi_id) return null;
          return {
            odi_id,
            make_canonical: m.canonical,
            model: clean(f[4]),
            model_year: parseYear(f[5]),
            component: clean(f[11]),
            date_received: parseDate(f[16]),
            narrative: clean(f[19]),
            // failure_mode / severity / embedding filled by 04 and 05
          };
        },
        3, 4,
      );
    } else if (key === "investigations") {
      // INV fields: 1 ACTION,2 MAKE,3 MODEL,4 YEAR,5 COMPNAME,7 ODATE,8 CDATE,10 SUBJECT,11 SUMMARY
      await loadDataset(
        "investigations", matcher, "investigations", "odi_action_no",
        (f, m) => {
          const odi_action_no = clean(f[0]);
          if (!odi_action_no) return null;
          return {
            odi_action_no,
            make_canonical: m.canonical,
            component: clean(f[4]),
            open_date: parseDate(f[6]),
            close_date: parseDate(f[7]),
            subject: clean(f[9]),
            summary: clean(f[10]),
          };
        },
        1, 2,
      );
    } else if (key === "tsbs") {
      // TSB fields: 1 NHTSA_ID,8 MAKE,9 MODEL,10 YEAR,11 COMPONENTS,14 SUMMARY
      await loadDataset(
        "tsbs", matcher, "tsbs", "tsb_id",
        (f, m) => {
          const tsb_id = clean(f[0]);
          if (!tsb_id) return null;
          return {
            tsb_id,
            make_canonical: m.canonical,
            model: clean(f[8]),
            model_year: parseYear(f[9]),
            component: clean(f[10]),
            summary: clean(f[13]),
          };
        },
        7, 8,
      );
    } else {
      console.warn(`unknown dataset "${key}"`);
    }
  }
  console.log("✓ 03_filter_rv complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
