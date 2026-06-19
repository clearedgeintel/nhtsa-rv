// 02_load_flat_files.ts — download + extract the NHTSA ODI bulk flat files to local
// staging (CLAUDE.md §5.2). No DB writes here — staging lives on disk (ingest/.data),
// and 03_filter_rv.ts reads it, filters to the RV slice, and loads only that.
//
// Run: npm run ingest:02
//   Optional: pass dataset keys to limit, e.g.  npm run ingest:02 -- recalls investigations

import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { download, extractZip } from "./lib/nhtsa.ts";
import { DATA_DIR } from "./lib/env.ts";
import { SOURCES, zipPath, extractDir, resolveDataFile, type SourceKey } from "./lib/sources.ts";

async function loadSource(key: SourceKey) {
  const src = SOURCES.find((s) => s.key === key)!;
  const zip = zipPath(DATA_DIR, key);
  console.log(`\n[${key}]`);
  try {
    await download(src.zipUrl, zip);
    await extractZip(zip, extractDir(DATA_DIR, key));
  } catch (e) {
    if (src.fallbackUrl) {
      console.warn(`  ! primary download failed (${String(e)}); trying Socrata fallback`);
      await mkdir(extractDir(DATA_DIR, key), { recursive: true });
      const dest = `${extractDir(DATA_DIR, key)}/${key}.tsv`;
      const res = await fetch(src.fallbackUrl);
      if (!res.ok) throw new Error(`fallback failed ${res.status}`);
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`  ↳ saved fallback ${dest}`);
    } else if (src.optional) {
      console.warn(`  ! optional source ${key} unavailable (${String(e)}); skipping`);
      return;
    } else {
      throw e;
    }
  }
  const file = await resolveDataFile(DATA_DIR, key);
  console.log(file ? `  ✓ ready: ${file}` : `  ! no data file found after extract`);
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  const argv = process.argv.slice(2);
  const keys = (argv.length ? argv : SOURCES.map((s) => s.key)) as SourceKey[];
  for (const k of keys) {
    if (!SOURCES.some((s) => s.key === k)) {
      console.warn(`skipping unknown source "${k}"`);
      continue;
    }
    await loadSource(k);
  }
  console.log(`\n✓ staging dir: ${existsSync(DATA_DIR) ? DATA_DIR : "(missing)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
