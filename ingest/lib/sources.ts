import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

// NHTSA ODI bulk flat-file sources. Confirmed live June 2026 (tab-delimited, no header).
// TSBs zip name has been unstable; it's marked optional with a Socrata fallback so the
// pipeline never blocks on it (least-critical dataset for RV defect intelligence).

export type SourceKey = "recalls" | "complaints" | "investigations" | "tsbs";

export type Source = {
  key: SourceKey;
  zipUrl: string;
  optional?: boolean;
  // Socrata export fallback (TSV) if the static zip is unavailable.
  fallbackUrl?: string;
};

export const SOURCES: Source[] = [
  { key: "recalls", zipUrl: "https://static.nhtsa.gov/odi/ffdd/rcl/FLAT_RCL_POST_2010.zip" },
  { key: "complaints", zipUrl: "https://static.nhtsa.gov/odi/ffdd/cmpl/FLAT_CMPL.zip" },
  { key: "investigations", zipUrl: "https://static.nhtsa.gov/odi/ffdd/inv/FLAT_INV.zip" },
  {
    key: "tsbs",
    zipUrl: "https://static.nhtsa.gov/odi/ffdd/tsbs/FLAT_TSBS.zip",
    optional: true,
    fallbackUrl: "https://datahub.transportation.gov/api/views/hczg-qbhf/rows.tsv?accessType=DOWNLOAD",
  },
];

export const sourceByKey = (k: SourceKey): Source => {
  const s = SOURCES.find((x) => x.key === k);
  if (!s) throw new Error(`Unknown source ${k}`);
  return s;
};

export const zipPath = (dataDir: string, k: SourceKey) => join(dataDir, `${k}.zip`);
export const extractDir = (dataDir: string, k: SourceKey) => join(dataDir, k);

/** After extraction, find the data .txt/.tsv file (largest one in the dir). */
export async function resolveDataFile(dataDir: string, k: SourceKey): Promise<string | null> {
  const dir = extractDir(dataDir, k);
  if (!existsSync(dir)) return null;
  const names = await readdir(dir);
  const candidates = names.filter((n) => /\.(txt|tsv)$/i.test(n));
  if (!candidates.length) return null;
  // Pick the largest candidate by name heuristic (FLAT_*.txt); fall back to first.
  const flat = candidates.find((n) => /^FLAT/i.test(n));
  return join(dir, flat ?? candidates[0]);
}
