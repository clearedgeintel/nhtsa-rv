import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";

// NHTSA ODI bulk flat files are TAB-delimited, NO header row, one record per line.
// (CLAUDE.md §5 says "pipe-delimited" — the real files are tab-delimited; we use tabs.)
// Free-text fields have had tabs/newlines stripped by NHTSA. Encoding is Windows-1252.

const cp1252 = new TextDecoder("windows-1252");
const TAB = 0x09;
const LF = 0x0a;
const CR = 0x0d;

/** Download a URL to a local file (streamed). Skips if the file already exists. */
export async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) {
    const { size } = await stat(dest);
    if (size > 0) {
      console.log(`  ↳ cached ${dest} (${(size / 1e6).toFixed(1)} MB)`);
      return;
    }
  }
  await mkdir(dirname(dest), { recursive: true });
  console.log(`  ↳ downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed ${res.status} ${res.statusText} for ${url}`);
  }
  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(dest);
    Readable.fromWeb(res.body as any)
      .pipe(out)
      .on("finish", () => resolve())
      .on("error", reject);
  });
  const { size } = await stat(dest);
  console.log(`  ↳ saved ${dest} (${(size / 1e6).toFixed(1)} MB)`);
}

/**
 * Extract a .zip into a directory. Picks a zip-capable extractor per platform:
 *  - Windows: System32\tar.exe (bsdtar) — a GNU `tar` from Git on PATH cannot read zips.
 *  - Linux/macOS: `unzip` — GNU `tar` on Linux likewise cannot read zips.
 */
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  await mkdir(destDir, { recursive: true });
  const [bin, args] =
    process.platform === "win32"
      ? [`${process.env.WINDIR ?? "C:\\Windows"}\\System32\\tar.exe`, ["-xf", zipPath, "-C", destDir]]
      : ["unzip", ["-o", "-q", zipPath, "-d", destDir]];
  await new Promise<void>((resolve, reject) => {
    const p = spawn(bin, args, { stdio: "inherit" });
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${bin} exited ${code} for ${zipPath}`)),
    );
  });
}

/**
 * Stream a tab-delimited flat file record-by-record, decoding Windows-1252.
 * Calls `onRecord(fields, lineNumber)` for each non-empty line. Never holds the
 * whole file in memory — safe for the multi-GB complaints file.
 */
export async function streamRecords(
  filePath: string,
  onRecord: (fields: string[], lineNo: number) => void | Promise<void>,
): Promise<number> {
  const stream = createReadStream(filePath);
  let pending: Buffer = Buffer.alloc(0);
  let lineNo = 0;

  const handleLine = async (line: Buffer) => {
    // Strip a trailing CR (CRLF files).
    let end = line.length;
    if (end > 0 && line[end - 1] === CR) end -= 1;
    if (end === 0) return;
    lineNo += 1;
    // Split on TAB at the byte level, decode each field as cp1252.
    const fields: string[] = [];
    let start = 0;
    for (let i = 0; i < end; i++) {
      if (line[i] === TAB) {
        fields.push(cp1252.decode(line.subarray(start, i)));
        start = i + 1;
      }
    }
    fields.push(cp1252.decode(line.subarray(start, end)));
    await onRecord(fields, lineNo);
  };

  for await (const chunk of stream) {
    let buf = pending.length ? Buffer.concat([pending, chunk as Buffer]) : (chunk as Buffer);
    let nl: number;
    let from = 0;
    while ((nl = buf.indexOf(LF, from)) !== -1) {
      await handleLine(buf.subarray(from, nl));
      from = nl + 1;
    }
    pending = buf.subarray(from);
  }
  if (pending.length) await handleLine(pending);
  return lineNo;
}

/** NHTSA dates are YYYYMMDD strings; convert to an ISO date (YYYY-MM-DD) or null. */
export function parseDate(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!/^\d{8}$/.test(t)) return null;
  const y = t.slice(0, 4), m = t.slice(4, 6), d = t.slice(6, 8);
  if (y === "0000" || m === "00" || d === "00") return null;
  return `${y}-${m}-${d}`;
}

/** Parse an integer field; returns null for blanks / sentinel 9999 when used as "unknown". */
export function parseInt0(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  if (!/^-?\d+$/.test(t)) return null;
  return Number(t);
}

/** Model year: NHTSA uses 9999 for unknown/NA. */
export function parseYear(s: string | undefined): number | null {
  const n = parseInt0(s);
  if (n === null || n === 9999 || n < 1900 || n > 2100) return null;
  return n;
}

/** Collapse whitespace and trim; return null for empties. */
export function clean(s: string | undefined): string | null {
  if (s == null) return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length ? t : null;
}
