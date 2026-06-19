// Discovery: list every raw MAKETXT in the staged flat files that does NOT currently map to
// a canonical RV make, with total record counts. Cross-reference against a brand list to find
// real RV makes to add. Run: npx tsx ingest/_discover_makes.ts
import { writeFileSync } from "node:fs";
import { MakeMatcher } from "./lib/makes.ts";
import { RV_MAKES_SEED } from "./data/rv_makes_seed.ts";
import { streamRecords } from "./lib/nhtsa.ts";
import { DATA_DIR } from "./lib/env.ts";
import { resolveDataFile } from "./lib/sources.ts";

const matcher = new MakeMatcher(RV_MAKES_SEED as never);
const unmatched = new Map<string, number>();

const datasets: [import("./lib/sources.ts").SourceKey, number][] = [
  ["recalls", 2], ["complaints", 3], ["investigations", 1],
];

for (const [key, makeIdx] of datasets) {
  const file = await resolveDataFile(DATA_DIR, key);
  if (!file) { console.warn(`skip ${key}`); continue; }
  console.log(`scanning ${key}…`);
  await streamRecords(file, (f) => {
    if (matcher.match(f[makeIdx])) return;
    const raw = (f[makeIdx] ?? "").trim().toUpperCase();
    if (raw) unmatched.set(raw, (unmatched.get(raw) ?? 0) + 1);
  });
}

const sorted = [...unmatched.entries()].sort((a, b) => b[1] - a[1]);
const lines = sorted.map(([m, c]) => `${String(c).padStart(8)}\t${m}`);
writeFileSync("ingest/.data/_unmatched_makes.txt", lines.join("\n"), "utf8");
console.log(`\n${sorted.length} distinct unmatched makes → ingest/.data/_unmatched_makes.txt`);
console.log("Top 60:\n" + lines.slice(0, 60).join("\n"));
