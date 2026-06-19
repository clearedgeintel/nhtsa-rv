// supabase/functions/ask — the natural-language RV defect agent (CLAUDE.md §6).
// Browser POSTs { question, history, stream? }. Runs a Claude tool-use loop server-side
// (keys never leave here). Returns either:
//   • JSON  { answer, sources, sql_used, narrative_hits, charts }   (default; evals/curl)
//   • SSE   data: {type:"text"|"status"|"done"|"error", ...}        (when stream:true)

import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./domain.ts";
import { TOOL_DEFS, executeSql, searchNarratives, renderChart, decodeVin, type ChartSpec } from "./tools.ts";

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
  if (name === "decode_vin") return decodeVin(input);
  return { error: `Unknown tool ${name}` };
}

type Emit = (e: Record<string, unknown>) => void;
type AgentResult = {
  answer: string; sources: string[]; sql_used: string[]; narrative_hits: unknown[];
  charts: ChartSpec[]; followups: string[];
};

const FOLLOWUP_TOOL: Anthropic.Tool = {
  name: "suggest_followups",
  description: "Record 2–3 short, specific follow-up questions the user could ask next.",
  input_schema: {
    type: "object",
    properties: {
      questions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 3 },
    },
    required: ["questions"],
  },
};

/** Cheap haiku call: propose follow-up questions based on the Q&A. Best-effort. */
async function generateFollowups(anthropic: Anthropic, question: string, answer: string): Promise<string[]> {
  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 300,
      system:
        "You suggest concise follow-up questions for an NHTSA RV safety-data assistant. Each must be a " +
        "short, specific, standalone question the user could ask next about RV recalls, complaints, " +
        "investigations, or TSBs — building naturally on the conversation. No preamble.",
      tools: [FOLLOWUP_TOOL],
      tool_choice: { type: "tool", name: "suggest_followups" },
      messages: [
        { role: "user", content: `Question: ${question}\n\nAnswer: ${answer.slice(0, 1500)}\n\nSuggest 3 follow-ups.` },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
    const qs = (block?.input as { questions?: unknown })?.questions;
    return Array.isArray(qs) ? qs.filter((q): q is string => typeof q === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

/** The agent loop. Streams text/status via `emit` and returns the final result. */
async function runAgent(
  anthropic: Anthropic,
  messages: Anthropic.MessageParam[],
  emit: Emit,
  question: string,
): Promise<AgentResult> {
  const sqlUsed: string[] = [];
  const narrativeHits: unknown[] = [];
  const charts: ChartSpec[] = [];
  const sources = new Set<string>();
  let answer = "";

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      system: buildSystemPrompt(),
      tools: TOOL_DEFS as Anthropic.Tool[],
      messages,
    });
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && (ev.delta as any).type === "text_delta") {
        emit({ type: "text", delta: (ev.delta as any).text });
      }
    }
    const msg = await stream.finalMessage();
    messages.push({ role: "assistant", content: msg.content });
    const txt = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    if (txt) answer = answer ? `${answer}\n${txt}` : txt;
    if (msg.stop_reason !== "tool_use") break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of msg.content) {
      if (block.type !== "tool_use") continue;
      emit({ type: "status", tool: block.name });
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

  if (!answer) answer = "I wasn't able to finish within the step limit. Please narrow the question.";
  const followups = await generateFollowups(anthropic, question, answer);
  return { answer, sources: [...sources], sql_used: sqlUsed, narrative_hits: narrativeHits, charts, followups };
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

  const wantStream =
    body?.stream === true || (req.headers.get("accept") ?? "").includes("text/event-stream");

  // Non-streaming JSON (default — used by evals, curl, and any client that omits stream).
  if (!wantStream) {
    try {
      const result = await runAgent(anthropic, messages, () => {}, question);
      return json(result);
    } catch (e) {
      return json({ error: `Agent error: ${String((e as Error)?.message ?? e)}` }, 500);
    }
  }

  // Server-Sent Events.
  const enc = new TextEncoder();
  const sse = new ReadableStream({
    async start(controller) {
      const emit: Emit = (e) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { /* closed */ }
      };
      try {
        const result = await runAgent(anthropic, messages, emit, question);
        emit({ type: "done", ...result });
      } catch (e) {
        emit({ type: "error", error: `Agent error: ${String((e as Error)?.message ?? e)}` });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(sse, {
    headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
});
