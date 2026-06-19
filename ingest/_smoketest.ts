// Offline smoke test (no DB / no keys): validates parsing + make-matching + chassis logic
// against a tiny synthetic recalls-shaped line. Run: npx tsx ingest/_smoketest.ts
import { writeFile, rm, mkdir } from "node:fs/promises";
import { MakeMatcher } from "./lib/makes.ts";
import { RV_MAKES_SEED } from "./data/rv_makes_seed.ts";
import { streamRecords, parseDate, parseYear, clean } from "./lib/nhtsa.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("  ok: " + msg);
}

async function main() {
  const m = new MakeMatcher(RV_MAKES_SEED as never);

  // make matching
  assert(m.match("WINNEBAGO")?.canonical === "WINNEBAGO", "WINNEBAGO → WINNEBAGO");
  assert(m.match("Thor Motor Coach")?.canonical === "THOR MOTOR COACH", "variant case-insensitive");
  assert(m.match("ITASCA")?.canonical === "WINNEBAGO", "ITASCA variant → WINNEBAGO");
  assert(m.match("FORD")?.isChassis === true, "FORD is chassis");
  assert(m.match("TESLA") === null, "non-RV make → null");

  // date / year helpers
  assert(parseDate("20240115") === "2024-01-15", "parseDate");
  assert(parseDate("00000000") === null, "parseDate sentinel null");
  assert(parseYear("9999") === null, "parseYear 9999 → null");
  assert(parseYear("2021") === 2021, "parseYear ok");
  assert(clean("  a   b ") === "a b", "clean collapses ws");

  // streaming parse of a synthetic tab line with cp1252 smart-quote byte (0x92)
  const dir = "ingest/.data/_smoke";
  await mkdir(dir, { recursive: true });
  const file = `${dir}/t.txt`;
  // two fields then a curly apostrophe encoded as cp1252 0x92
  const bytes = Buffer.concat([
    Buffer.from("CAMP1\tWINNEBAGO\tbrake"),
    Buffer.from([0x92]),
    Buffer.from("s line\n"),
  ]);
  await writeFile(file, bytes);
  let got: string[] = [];
  const n = await streamRecords(file, (f) => { got = f; });
  assert(n === 1, "streamRecords one line");
  assert(got.length === 3 && got[1] === "WINNEBAGO", "tab split correct");
  assert(got[2].includes("brake") && got[2].includes("s line"), "cp1252 decoded field");
  await rm(dir, { recursive: true, force: true });

  console.log("\n✓ smoke test passed");
}
main().catch((e) => { console.error(e); process.exit(1); });
