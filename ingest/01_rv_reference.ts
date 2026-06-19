// 01_rv_reference.ts — seed the rv_makes reference (CLAUDE.md §5.1).
// The curated brand list in data/rv_makes_seed.ts is the source of truth. (vPIC's
// GetMakesForVehicleType was evaluated but rejected for bulk enrichment: the "motorhome"
// type returns nothing useful and "trailer" returns ~9,500 makes covering every utility/
// boat/cargo trailer brand — too noisy to match against. Instead, 03_filter_rv reports the
// top UNMATCHED makes actually present in the NHTSA data, which is the right signal for
// widening this curated list empirically.)
// Idempotent: upserts on make_canonical.
//
// Run: npm run ingest:01

import { RV_MAKES_SEED } from "./data/rv_makes_seed.ts";
import { upsertBatched } from "./lib/db.ts";

async function main() {
  const rows = RV_MAKES_SEED.map((m) => ({
    make_canonical: m.make_canonical,
    make_variants: m.make_variants,
    category: m.category,
    is_motorhome_chassis: m.is_motorhome_chassis,
  }));

  const chassis = rows.filter((r) => r.is_motorhome_chassis).length;
  console.log(`rv_makes: ${rows.length} curated makes (${chassis} chassis, ${rows.length - chassis} coach/towable)`);
  const sent = await upsertBatched("rv_makes", rows, "make_canonical");
  console.log(`✓ upserted ${sent} rv_makes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
