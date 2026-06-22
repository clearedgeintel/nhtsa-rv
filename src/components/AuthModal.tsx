import { useEffect, useRef, useState } from "react";
import { signIn, signUp } from "../lib/auth";

/** Email + password sign-in / sign-up modal. Closes itself on success. */
export function AuthModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => emailRef.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "up") {
        const { needsConfirm } = await signUp(email.trim(), password);
        if (needsConfirm) {
          setNotice("Account created. Check your email to confirm, then sign in.");
          setMode("in");
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      onClose(); // signed in
    } catch (err) {
      setError((err as Error)?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={mode === "in" ? "Sign in" : "Create account"}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 dark:bg-slate-800 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {mode === "in" ? "Sign in" : "Create your account"}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {mode === "in"
            ? "Sign in to save your work across sessions."
            : "Just an email and password — no confirmation needed."}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Email</span>
            <input
              ref={emailRef}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-900/40"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Password</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-emerald-900/40"
              placeholder={mode === "up" ? "At least 6 characters" : "••••••••"}
            />
          </label>

          {error && <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
          {notice && <p className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-br from-emerald-700 to-emerald-900 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-800/30 transition hover:from-emerald-800 hover:to-emerald-950 disabled:opacity-50"
          >
            {busy ? "Working…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          {mode === "in" ? (
            <>
              New here?{" "}
              <button onClick={() => { setMode("up"); setError(null); }} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button onClick={() => { setMode("in"); setError(null); }} className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
