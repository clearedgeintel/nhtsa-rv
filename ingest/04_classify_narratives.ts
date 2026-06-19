// 04_classify_narratives.ts — extract failure_mode + severity per complaint (CLAUDE.md §5.4).
// One claude-haiku-4-5 call per complaint, forced through a structured tool so output is
// always valid. This is what makes "semantic-feeling" questions answerable by plain SQL.
//
// SAFE BY DEFAULT: a bare run only REPORTS how many complaints need classification and a
// rough cost estimate. Pass --commit to actually call the API and write results.
//
// Run: npm run ingest:04                 (dry run: count + estimate)
//      npm run ingest:04 -- --commit     (classify all pending)
//      npm run ingest:04 -- --commit --limit 200

import Anthropic from "@anthropic-ai/sdk";
import { db } from "./lib/db.ts";
import { env } from "./lib/env.ts";

const MODEL = "claude-haiku-4-5";

const FAILURE_MODES = [
  "fire", "brakes", "tires", "suspension", "steering", "electrical",
  "water_intrusion", "slide_out", "leveling_jacks", "engine", "transmission",
  "fuel_system", "propane_lp", "structural", "appliance", "awning",
  "chassis", "wheels", "lighting", "other",
];
const SEVERITIES = ["minor", "moderate", "severe", "critical"];

const TOOL: Anthropic.Tool = {
  name: "classify_complaint",
  description: "Record the structured classification of an RV complaint narrative.",
  input_schema: {
    type: "object",
    properties: {
      failure_mode: { type: "string", enum: FAILURE_MODES, description: "Best-fitting failure category." },
      severity: {
        type: "string", enum: SEVERITIES,
        description: "minor=cosmetic/inconvenience, moderate=functional loss, severe=safety risk, critical=crash/fire/injury",
      },
    },
    required: ["failure_mode", "severity"],
  },
};

const SYSTEM =
  "You classify NHTSA RV (recreational vehicle) consumer complaint narratives. " +
  "Read the narrative and call classify_complaint with the single best-fitting failure_mode " +
  "and a severity reflecting the described safety consequence. Base it only on the text.";

type Pending = { odi_id: string; narrative: string };

async function fetchPending(limit: number): Promise<Pending[]> {
  const { data, error } = await db()
    .from("complaints")
    .select("odi_id, narrative")
    .is("failure_mode", null)
    .not("narrative", "is", null)
    .limit(limit);
  if (error) throw new Error(`fetch pending failed: ${error.message}`);
  return (data ?? []) as Pending[];
}

async function countPending(): Promise<number> {
  const { count, error } = await db()
    .from("complaints")
    .select("odi_id", { count: "exact", head: true })
    .is("failure_mode", null)
    .not("narrative", "is", null);
  if (error) throw new Error(`count failed: ${error.message}`);
  return count ?? 0;
}

async function classifyOne(client: Anthropic, c: Pending): Promise<void> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: "classify_complaint" },
    messages: [{ role: "user", content: c.narrative.slice(0, 4000) }],
  });
  const block = res.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
  if (!block) throw new Error(`no tool_use for ${c.odi_id}`);
  const { failure_mode, severity } = block.input as { failure_mode: string; severity: string };
  const { error } = await db()
    .from("complaints")
    .update({ failure_mode, severity })
    .eq("odi_id", c.odi_id);
  if (error) throw new Error(`update ${c.odi_id} failed: ${error.message}`);
}

/** Run tasks with bounded concurrency. */
async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>): Promise<number> {
  let i = 0, done = 0, failed = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const item = items[i++];
        try {
          await fn(item);
          done++;
        } catch (e) {
          failed++;
          if (failed <= 5) console.warn(`  ! ${String(e)}`);
        }
        if (done % 50 === 0 && done) process.stdout.write(`  …${done}\n`);
      }
    }),
  );
  if (failed) console.warn(`  (${failed} failures)`);
  return done;
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const limArg = args.indexOf("--limit");
  const limit = limArg >= 0 ? Number(args[limArg + 1]) : Infinity;

  const pending = await countPending();
  const target = Math.min(pending, limit);
  // Rough estimate: ~450 input + ~25 output tokens per call at haiku list price.
  const estUsd = (target * (450 * 1.0 + 25 * 5.0)) / 1e6;
  console.log(`complaints needing classification: ${pending}`);
  console.log(`would classify: ${Number.isFinite(limit) ? target : pending} (model ${MODEL}), est. ~$${estUsd.toFixed(2)}`);

  if (!commit) {
    console.log("\nDry run. Re-run with --commit to classify.");
    return;
  }

  const client = new Anthropic({ apiKey: env.anthropicKey() });
  let processed = 0;
  while (processed < limit) {
    const page = await fetchPending(Math.min(200, limit - processed));
    if (!page.length) break;
    const did = await pool(page, 8, (c) => classifyOne(client, c));
    processed += did;
    console.log(`  committed ${processed}/${Number.isFinite(limit) ? target : pending}`);
    if (did === 0) break; // avoid infinite loop if a page all-fails
  }
  console.log(`✓ classified ${processed} complaints`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
