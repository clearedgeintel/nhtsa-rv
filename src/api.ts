import type { AskResponse, ChatMessage, DataStatus, Grounding } from "./types";

const FN_URL = import.meta.env.VITE_ASK_FUNCTION_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const TOOL_STATUS: Record<string, string> = {
  execute_sql: "Querying the data…",
  search_narratives: "Searching complaint narratives…",
  decode_vin: "Decoding VIN…",
  render_chart: "Building chart…",
};

export type StreamHandlers = {
  onText: (delta: string) => void;
  onStatus: (label: string) => void;
  onDone: (r: AskResponse) => void;
  onError: (msg: string) => void;
};

/** Streaming variant — reads Server-Sent Events from the function and calls handlers. */
export async function askAgentStream(
  question: string,
  history: ChatMessage[],
  h: StreamHandlers,
): Promise<void> {
  if (!FN_URL || !ANON) return h.onError("Missing VITE_ASK_FUNCTION_URL / VITE_SUPABASE_ANON_KEY in .env");
  let res: Response;
  try {
    res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({
        question,
        history: history.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });
  } catch (e) {
    return h.onError(`Network error: ${String((e as Error)?.message ?? e)}`);
  }
  if (!res.ok || !res.body) {
    try {
      const j = (await res.json()) as AskResponse;
      return h.onError(j.error || `Request failed (HTTP ${res.status})`);
    } catch {
      return h.onError(`Request failed (HTTP ${res.status})`);
    }
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = block.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let e: any;
      try {
        e = JSON.parse(line.slice(5).trim());
      } catch {
        continue;
      }
      if (e.type === "text") h.onText(e.delta ?? "");
      else if (e.type === "status") h.onStatus(TOOL_STATUS[e.tool] ?? "Working…");
      else if (e.type === "done") h.onDone(e as AskResponse);
      else if (e.type === "error") h.onError(e.error ?? "Agent error");
    }
  }
}

/** Read the data-refresh status (last ingest time + counts) from app_meta via PostgREST. */
export async function getDataStatus(): Promise<DataStatus | null> {
  if (!SUPABASE_URL || !ANON) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_meta?key=eq.data_status&select=value`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { value: DataStatus }[];
    return rows?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

/** Classify how grounded an answer is, for the trust badge. */
export function groundingOf(res: AskResponse): Grounding {
  if ((res.sql_used?.length ?? 0) > 0) return "sql";
  if ((res.narrative_hits?.length ?? 0) > 0) return "semantic";
  return "none";
}

/** Log thumbs feedback to the feedback table (insert-only via PostgREST). Best-effort. */
export async function submitFeedback(rating: "up" | "down", m: ChatMessage): Promise<void> {
  if (!SUPABASE_URL || !ANON) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${ANON}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        rating,
        question: m.question ?? null,
        answer: m.content,
        sql_used: m.sql_used ?? null,
        sources: m.sources ?? null,
      }),
    });
  } catch {
    /* non-blocking */
  }
}

/** Call the server-side agent. History carries prior turns as plain role/content. */
export async function askAgent(question: string, history: ChatMessage[]): Promise<AskResponse> {
  if (!FN_URL || !ANON) {
    return { error: "Missing VITE_ASK_FUNCTION_URL / VITE_SUPABASE_ANON_KEY in .env" };
  }
  try {
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({
        question,
        history: history.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    let data: AskResponse;
    try {
      data = (await res.json()) as AskResponse;
    } catch {
      return { error: `Unexpected response (HTTP ${res.status})` };
    }
    if (!res.ok && !data.error) data.error = `Request failed (HTTP ${res.status})`;
    return data;
  } catch (e) {
    return { error: `Network error: ${String((e as Error)?.message ?? e)}` };
  }
}
