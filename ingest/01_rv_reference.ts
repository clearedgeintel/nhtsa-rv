// 01_rv_reference.ts — seed the rv_makes reference (CLAUDE.md §5.1).
// Curated brand list (source of truth) enriched with vPIC motorhome/trailer makes.
// Idempotent: upserts on make_canonical.
//
// Run: npm run ingest:01

import { RV_MAKES_SEED, type RvMakeSeed } from "./data/rv_makes_seed.ts";
import { normMake } from "./lib/makes.ts";
import { upsertBatched } from "./lib/db.ts";

type VpicMake = { MakeName: string };

async function vpicMakes(vehicleType: string): Promise<string[]> {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/${vehicleType}?format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const json = (await res.json()) as { Results?: VpicMake[] };
    return (json.Results ?? []).map((r) => r.MakeName).filter(Boolean);
  } catch (e) {
    console.warn(`  ! vPIC ${vehicleType} fetch failed (${String(e)}); continuing with curated list`);
    return [];
  }
}

async function main() {
  // Start from the curated seed; track every normalized variant already covered.
  const byCanonical = new Map<string, RvMakeSeed>();
  const covered = new Set<string>();
  for (const m of RV_MAKES_SEED) {
    byCanonical.set(m.make_canonical, { ...m, make_variants: [...m.make_variants] });
    for (const v of [m.make_canonical, ...m.make_variants]) covered.add(normMake(v));
  }
  const curatedCount = byCanonical.size;

  // Enrich with vPIC: any motorhome/trailer make not already covered becomes a new entry.
  const [motorhomes, trailers] = await Promise.all([
    vpicMakes("motorhome"),
    vpicMakes("trailer"),
  ]);
  let added = 0;
  const enrich = (names: string[], category: "coach" | "towable") => {
    for (const name of names) {
      const key = normMake(name);
      if (!key || covered.has(key)) continue;
      const canonical = key; // normalized uppercase form as canonical
      byCanonical.set(canonical, {
        make_canonical: canonical,
        make_variants: [name],
        category,
        is_motorhome_chassis: false,
      });
      covered.add(key);
      added++;
    }
  };
  enrich(motorhomes, "coach");
  enrich(trailers, "towable");

  const rows = [...byCanonical.values()].map((m) => ({
    make_canonical: m.make_canonical,
    make_variants: m.make_variants,
    category: m.category,
    is_motorhome_chassis: m.is_motorhome_chassis,
  }));

  console.log(
    `rv_makes: ${curatedCount} curated + ${added} from vPIC (motorhome=${motorhomes.length}, trailer=${trailers.length}) = ${rows.length} total`,
  );
  const sent = await upsertBatched("rv_makes", rows, "make_canonical");
  console.log(`✓ upserted ${sent} rv_makes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
