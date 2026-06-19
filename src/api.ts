import type {
  AskResponse,
  ChatMessage,
  ComplaintDetail,
  DataStatus,
  ExploreFilters,
  ExploreOptions,
  FailureModeRow,
  Grounding,
} from "./types";

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

const restHeaders = () => ({ apikey: ANON, Authorization: `Bearer ${ANON}` });
const rpcHeaders = () => ({ ...restHeaders(), "Content-Type": "application/json" });

/** Map slicer state → the NULL-tolerant RPC param names shared by all three RPCs. */
function rpcFilterArgs(f?: ExploreFilters) {
  return {
    p_make: f?.make ?? null,
    p_my_from: f?.my_from ?? null,
    p_my_to: f?.my_to ?? null,
    p_recv_from: f?.recv_from ?? null,
    p_recv_to: f?.recv_to ?? null,
  };
}

async function callRpc<T>(fn: string, body: Record<string, unknown>): Promise<T[]> {
  if (!SUPABASE_URL || !ANON) return [];
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: rpcHeaders(),
      body: JSON.stringify(body),
    });
    return r.ok ? ((await r.json()) as T[]) : [];
  } catch {
    return [];
  }
}

/** Explore: failure-mode summary (counts + severity split) for the heatmap, sliced by filters. */
export async function getFailureModes(filters?: ExploreFilters): Promise<FailureModeRow[]> {
  const rows = await callRpc<FailureModeRow>("rpc_failure_mode_summary", rpcFilterArgs(filters));
  return rows.sort((a, b) => b.complaints - a.complaints);
}

/** Explore: top components + makes for one failure mode (drill-down), sliced by filters. */
export async function getModeBreakdown(
  mode: string,
  filters?: ExploreFilters,
): Promise<{
  components: { component: string; n: number }[];
  makes: { make_canonical: string; n: number }[];
}> {
  const args = { p_mode: mode, ...rpcFilterArgs(filters) };
  const [components, makes] = await Promise.all([
    callRpc<{ component: string; n: number }>("rpc_failure_mode_component", args),
    callRpc<{ make_canonical: string; n: number }>("rpc_failure_mode_make", args),
  ]);
  return { components, makes };
}

/** Explore: the actual complaint records behind a heatmap count (drill-through). */
export async function getModeDetails(
  mode: string,
  severity: string | null,
  filters?: ExploreFilters,
  limit = 25,
): Promise<ComplaintDetail[]> {
  return callRpc<ComplaintDetail>("rpc_failure_mode_details", {
    p_mode: mode,
    p_severity: severity ?? null,
    ...rpcFilterArgs(filters),
    p_limit: limit,
  });
}

/** Explore: option sources for the slicers (brand list + model-year / received-year bounds). */
export async function getExploreOptions(): Promise<ExploreOptions | null> {
  if (!SUPABASE_URL || !ANON) return null;
  try {
    const [mk, bd] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/v_explore_makes?select=make_canonical&order=n.desc`, { headers: restHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/v_explore_bounds?select=*`, { headers: restHeaders() }),
    ]);
    const makes = mk.ok ? ((await mk.json()) as { make_canonical: string }[]).map((r) => r.make_canonical) : [];
    const b = bd.ok ? ((await bd.json()) as ExploreOptions[])[0] : null;
    if (!b) return null;
    return { makes, my_min: b.my_min, my_max: b.my_max, recv_min: b.recv_min, recv_max: b.recv_max };
  } catch {
    return null;
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
