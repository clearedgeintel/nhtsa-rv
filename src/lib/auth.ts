// Minimal email/password auth against Supabase GoTrue's REST API — no supabase-js dep,
// consistent with the app's raw-fetch pattern. The session (access + refresh tokens) is
// persisted to localStorage and exposed via a tiny external store so React can subscribe.
// Email confirmation is expected to be DISABLED in the Supabase dashboard, so signUp
// returns a session immediately; the confirmation-on path is handled gracefully anyway.
import { useSyncExternalStore } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const KEY = "rvdi-auth";

export type AuthUser = { id: string; email: string | null };
type Session = { access_token: string; refresh_token: string; expires_at: number; user: AuthUser };

let session: Session | null = load();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
function persist(s: Session | null) {
  session = s;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  emit();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
export function getSession() {
  return session;
}

function mkSession(d: any): Session {
  return {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at ?? Math.floor(Date.now() / 1000) + (d.expires_in ?? 3600),
    user: { id: d.user?.id ?? d.id, email: d.user?.email ?? d.email ?? null },
  };
}

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.msg || data?.error_description || data?.error || `Request failed (${res.status})`);
  }
  return data;
}

/** Sign up with email + password. Returns needsConfirm=true only if confirmations are on. */
export async function signUp(email: string, password: string): Promise<{ needsConfirm: boolean }> {
  const d = await post("/signup", { email, password });
  if (d.access_token) {
    persist(mkSession(d));
    return { needsConfirm: false };
  }
  return { needsConfirm: true };
}

export async function signIn(email: string, password: string): Promise<void> {
  persist(mkSession(await post("/token?grant_type=password", { email, password })));
}

export async function signOut(): Promise<void> {
  const s = session;
  persist(null);
  if (s) {
    try {
      await post("/logout", {}, s.access_token);
    } catch {
      /* token already invalid — local clear is enough */
    }
  }
}

/** Return a valid access token, refreshing if it's within 60s of expiry. */
export async function ensureFreshToken(): Promise<string | null> {
  if (!session) return null;
  if (session.expires_at - 60 > Math.floor(Date.now() / 1000)) return session.access_token;
  try {
    persist(mkSession(await post("/token?grant_type=refresh_token", { refresh_token: session.refresh_token })));
    return session?.access_token ?? null;
  } catch {
    persist(null);
    return null;
  }
}

/** React hook: the current signed-in user (or null). */
export function useAuthUser(): AuthUser | null {
  return useSyncExternalStore(subscribe, getSession, getSession)?.user ?? null;
}
