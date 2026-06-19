import type { AskResponse, ChatMessage, Grounding } from "./types";

const FN_URL = import.meta.env.VITE_ASK_FUNCTION_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

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
