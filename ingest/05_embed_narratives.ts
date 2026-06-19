// 05_embed_narratives.ts — embed complaint narratives via Voyage AI into pgvector (§5.5).
// Model voyage-3.5 → 1024-dim vectors (matches complaints.embedding vector(1024)).
//
// SAFE BY DEFAULT: a bare run only REPORTS how many narratives need embedding + an estimate.
// Pass --commit to call the API and write vectors.
//
// Run: npm run ingest:05                 (dry run)
//      npm run ingest:05 -- --commit     (embed all pending)

import { db, upsertBatched } from "./lib/db.ts";
import { env } from "./lib/env.ts";

const MODEL = "voyage-3.5"; // 1024-dim default output
const BATCH = 64;

type Pending = { odi_id: string; narrative: string };

async function fetchPending(limit: number): Promise<Pending[]> {
  const { data, error } = await db()
    .from("complaints")
    .select("odi_id, narrative")
    .is("embedding", null)
    .not("narrative", "is", null)
    .limit(limit);
  if (error) throw new Error(`fetch pending failed: ${error.message}`);
  return (data ?? []) as Pending[];
}

async function countPending(): Promise<number> {
  const { count, error } = await db()
    .from("complaints")
    .select("odi_id", { count: "exact", head: true })
    .is("embedding", null)
    .not("narrative", "is", null);
  if (error) throw new Error(`count failed: ${error.message}`);
  return count ?? 0;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.voyageKey()}`,
    },
    body: JSON.stringify({ input: texts, model: MODEL, input_type: "document" }),
  });
  if (!res.ok) {
    throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
  // Preserve input order.
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** pgvector wants a string literal like "[0.1,0.2,...]" over PostgREST. */
const toVec = (arr: number[]) => `[${arr.join(",")}]`;

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const limArg = args.indexOf("--limit");
  const limit = limArg >= 0 ? Number(args[limArg + 1]) : Infinity;

  const pending = await countPending();
  // voyage-3.5 ≈ $0.06 / 1M tokens; assume ~120 tokens per narrative.
  const estUsd = (Math.min(pending, limit) * 120 * 0.06) / 1e6;
  console.log(`narratives needing embedding: ${pending}`);
  console.log(`would embed with ${MODEL} (1024-dim), est. ~$${estUsd.toFixed(3)}`);
  if (!commit) {
    console.log("\nDry run. Re-run with --commit to embed.");
    return;
  }

  let processed = 0;
  while (processed < limit) {
    const page = await fetchPending(Math.min(500, limit - processed));
    if (!page.length) break;
    for (let i = 0; i < page.length; i += BATCH) {
      const slice = page.slice(i, i + BATCH);
      const vectors = await embedBatch(slice.map((p) => p.narrative.slice(0, 8000)));
      const rows = slice.map((p, j) => ({ odi_id: p.odi_id, embedding: toVec(vectors[j]) }));
      await upsertBatched("complaints", rows, "odi_id", 500);
      processed += slice.length;
      process.stdout.write(`  …${processed}\n`);
      if (processed >= limit) break;
    }
  }
  console.log(`✓ embedded ${processed} narratives`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
