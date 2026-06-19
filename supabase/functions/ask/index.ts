// supabase/functions/ask — the natural-language RV defect agent (CLAUDE.md §6).
// Browser POSTs { question, history }. We run a Claude tool-use loop server-side (keys never
// leave here) and return { answer, sources, sql_used, narrative_hits } for the provenance panel.

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./domain.ts";
import { TOOL_DEFS, executeSql, searchNarratives, renderChart, type ChartSpec } from "./tools.ts";

const MODEL = "claude-sonnet-4-6";
const MAX_STEPS = 8;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Best-effort in-memory rate limit (per warm instance): 20 requests / 60s / IP.
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now(), windowMs = 60_000, max = 20;
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}

type Msg = { role: "user" | "assistant"; content: string };
function sanitizeHistory(h: unknown): Msg[] {
  if (!Array.isArray(h)) return [];
  return h
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content }));
}

// Pull verifiable identifiers out of tool results for the "sources" list.
const ID_KEYS = ["campaign_id", "odi_id", "odi_action_no", "tsb_id"];
function collectIds(result: any, into: Set<string>) {
  const rows = result?.rows ?? result?.hits ?? [];
  if (!Array.isArray(rows)) return;
  for (const r of rows) for (const k of ID_KEYS) if (r?.[k]) into.add(`${k}:${r[k]}`);
}

async function runTool(name: string, input: any): Promise<unknown> {
  if (name === "execute_sql") return executeSql(input);
  if (name === "search_narratives") return searchNarratives(input);
  if (name === "render_chart") return renderChart(input);
  return { error: `Unknown tool ${name}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "Rate limit exceeded. Try again shortly." }, 429);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) return json({ error: "Missing 'question'." }, 400);

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Server missing ANTHROPIC_API_KEY secret." }, 500);
  const anthropic = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    ...sanitizeHistory(body?.history),
    { role: "user", content: question },
  ];

  const sqlUsed: string[] = [];
  const narrativeHits: unknown[] = [];
  const charts: ChartSpec[] = [];
  const sources = new Set<string>();

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: buildSystemPrompt(),
        tools: TOOL_DEFS as Anthropic.Tool[],
        messages,
      });
      messages.push({ role: "assistant", content: res.content });

      if (res.stop_reason !== "tool_use") {
        const answer = res.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();
        return json({ answer, sources: [...sources], sql_used: sqlUsed, narrative_hits: narrativeHits, charts });
      }

      // Execute each requested tool and feed results back.
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type !== "tool_use") continue;
        const result = await runTool(block.name, block.input);
        collectIds(result, sources);
        if (block.name === "execute_sql" && (result as any)?.sql_used) sqlUsed.push((result as any).sql_used);
        if (block.name === "search_narratives" && (result as any)?.hits) narrativeHits.push(...(result as any).hits);
        if (block.name === "render_chart" && (result as any)?.chart) charts.push((result as any).chart);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result).slice(0, 60_000),
        });
      }
      messages.push({ role: "user", content: toolResults });
    }
    return json({
      answer: "I wasn't able to finish within the step limit. Please narrow the question.",
      sources: [...sources], sql_used: sqlUsed, narrative_hits: narrativeHits, charts,
    });
  } catch (e) {
    return json({ error: `Agent error: ${String((e as Error)?.message ?? e)}` }, 500);
  }
});
