// Per-user data (history, saved RVs, saved searches) over PostgREST, authenticated with
// the signed-in user's access token. RLS (migration 0015) enforces owner-only access, so
// these never need to pass user_id — the row default + policy handle it. All calls no-op
// gracefully when signed out.
import { ensureFreshToken } from "./auth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export type ChatRow = {
  id: string;
  question: string;
  answer: string;
  sources: string[] | null;
  sql_used: string[] | null;
  grounding: string | null;
  created_at: string;
};
export type RvProfile = {
  id: string;
  label: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  model_year: number | null;
  created_at: string;
};
export type SavedSearch = {
  id: string;
  label: string;
  query: string | null;
  kind: string;
  params: Record<string, unknown> | null;
  created_at: string;
};

async function rest(path: string, init: RequestInit = {}): Promise<Response | null> {
  const token = await ensureFreshToken();
  if (!token) return null;
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function list<T>(table: string, limit = 50): Promise<T[]> {
  const r = await rest(`${table}?select=*&order=created_at.desc&limit=${limit}`);
  return r?.ok ? ((await r.json()) as T[]) : [];
}

async function insert<T>(table: string, row: Record<string, unknown>): Promise<T | null> {
  const r = await rest(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!r?.ok) return null;
  const rows = (await r.json()) as T[];
  return rows[0] ?? null;
}

async function remove(table: string, id: string): Promise<boolean> {
  const r = await rest(`${table}?id=eq.${id}`, { method: "DELETE" });
  return !!r?.ok;
}

// ── Chat history ──────────────────────────────────────────────────────────────
export const listChats = () => list<ChatRow>("chat_history");
export const saveChat = (c: {
  question: string;
  answer: string;
  sources?: string[] | null;
  sql_used?: string[] | null;
  grounding?: string | null;
}) =>
  insert<ChatRow>("chat_history", {
    question: c.question,
    answer: c.answer,
    sources: c.sources ?? null,
    sql_used: c.sql_used ?? null,
    grounding: c.grounding ?? null,
  });
export const deleteChat = (id: string) => remove("chat_history", id);

// ── Saved RV profiles ─────────────────────────────────────────────────────────
export const listProfiles = () => list<RvProfile>("rv_profiles");
export const saveProfile = (p: Omit<RvProfile, "id" | "created_at">) => insert<RvProfile>("rv_profiles", { ...p });
export const deleteProfile = (id: string) => remove("rv_profiles", id);

// ── Saved searches ────────────────────────────────────────────────────────────
export const listSearches = () => list<SavedSearch>("saved_searches");
export const saveSearch = (s: { label: string; query?: string | null; kind?: string; params?: Record<string, unknown> | null }) =>
  insert<SavedSearch>("saved_searches", {
    label: s.label,
    query: s.query ?? null,
    kind: s.kind ?? "question",
    params: s.params ?? null,
  });
export const deleteSearch = (id: string) => remove("saved_searches", id);
