// 06_stamp_refresh.ts — record the data-refresh status the UI shows. Run last in the
// pipeline (after 01–05). Writes app_meta.data_status = { refreshed_at, counts }.
//
// Run: npm run ingest:stamp

import { db } from "./lib/db.ts";

async function count(table: string): Promise<number> {
  const { count, error } = await db().from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table} failed: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const [recalls, complaints, investigations, makes] = await Promise.all([
    count("recalls"),
    count("complaints"),
    count("investigations"),
    count("rv_makes"),
  ]);

  const value = {
    refreshed_at: new Date().toISOString(),
    recalls,
    complaints,
    investigations,
    makes,
  };

  const { error } = await db()
    .from("app_meta")
    .upsert({ key: "data_status", value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw new Error(`stamp failed: ${error.message}`);

  console.log("✓ stamped data_status:", JSON.stringify(value));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
