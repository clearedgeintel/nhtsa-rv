import type { AskResponse, ChatMessage } from "./types";

const FN_URL = import.meta.env.VITE_ASK_FUNCTION_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

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
