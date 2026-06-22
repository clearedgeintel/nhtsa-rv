import { useEffect, useState } from "react";
import {
  listChats, deleteChat, type ChatRow,
  listProfiles, saveProfile, deleteProfile, type RvProfile,
  listSearches, deleteSearch, type SavedSearch,
} from "../lib/userData";

/** Build a scoped question for a saved RV profile. */
function rvQuestion(p: RvProfile): string {
  if (p.vin) return `Look up the safety recalls and complaints for VIN ${p.vin}.`;
  const rig = [p.model_year, p.make, p.model].filter(Boolean).join(" ");
  return `Summarize the recalls and complaints for ${rig || p.label}.`;
}

function Row({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-800">
      <div className="min-w-0 flex-1">{children}</div>
      <button onClick={onDelete} title="Delete" className="shrink-0 text-slate-400 hover:text-red-500">✕</button>
    </li>
  );
}

const tabs = [
  { key: "history", label: "History" },
  { key: "rvs", label: "My RVs" },
  { key: "saved", label: "Saved" },
] as const;
type Tab = (typeof tabs)[number]["key"];

export function AccountPanel({
  email,
  onClose,
  onLoadChat,
  onAsk,
}: {
  email: string | null;
  onClose: () => void;
  onLoadChat: (c: ChatRow) => void;
  onAsk: (q: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("history");
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [rvs, setRvs] = useState<RvProfile[]>([]);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  // add-RV form
  const [f, setF] = useState({ label: "", vin: "", make: "", model: "", model_year: "" });

  useEffect(() => {
    Promise.all([listChats(), listProfiles(), listSearches()]).then(([c, p, s]) => {
      setChats(c); setRvs(p); setSearches(s); setLoading(false);
    });
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function addRv(e: React.FormEvent) {
    e.preventDefault();
    if (!f.label.trim()) return;
    const created = await saveProfile({
      label: f.label.trim(),
      vin: f.vin.trim() || null,
      make: f.make.trim() || null,
      model: f.model.trim() || null,
      model_year: f.model_year ? Number(f.model_year) : null,
    });
    if (created) {
      setRvs((r) => [created, ...r]);
      setF({ label: "", vin: "", make: "", model: "", model_year: "" });
    }
  }

  const inputCls =
    "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Your account">
      <div className="flex h-full w-full max-w-md flex-col bg-slate-50 shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Your account</div>
            <div className="truncate text-xs text-slate-500 dark:text-slate-400">{email}</div>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700">✕</button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-3 pt-2 dark:border-slate-700">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "rounded-t-md px-3 py-1.5 text-xs font-semibold transition " +
                (tab === t.key
                  ? "bg-white text-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")
              }
            >
              {t.label}
              <span className="ml-1 text-[10px] text-slate-400">
                {t.key === "history" ? chats.length : t.key === "rvs" ? rvs.length : searches.length}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : tab === "history" ? (
            chats.length === 0 ? (
              <p className="text-sm text-slate-400">No saved conversations yet. Ask a question and it'll appear here.</p>
            ) : (
              <ul className="space-y-2">
                {chats.map((c) => (
                  <Row key={c.id} onDelete={() => deleteChat(c.id).then((ok) => ok && setChats((x) => x.filter((y) => y.id !== c.id)))}>
                    <button onClick={() => onLoadChat(c)} className="block w-full text-left">
                      <div className="line-clamp-2 text-xs font-medium text-slate-700 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300">{c.question}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{new Date(c.created_at).toLocaleString()}</div>
                    </button>
                  </Row>
                ))}
              </ul>
            )
          ) : tab === "rvs" ? (
            <div>
              <form onSubmit={addRv} className="mb-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Add an RV</div>
                <input className={inputCls} placeholder="Label (e.g. My 2022 Grand Design)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
                <input className={inputCls} placeholder="VIN (optional)" value={f.vin} onChange={(e) => setF({ ...f, vin: e.target.value.toUpperCase() })} />
                <div className="grid grid-cols-3 gap-2">
                  <input className={inputCls} placeholder="Make" value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} />
                  <input className={inputCls} placeholder="Model" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} />
                  <input className={inputCls} placeholder="Year" inputMode="numeric" value={f.model_year} onChange={(e) => setF({ ...f, model_year: e.target.value.replace(/\D/g, "") })} />
                </div>
                <button type="submit" disabled={!f.label.trim()} className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">Save RV</button>
              </form>
              {rvs.length === 0 ? (
                <p className="text-sm text-slate-400">No saved RVs yet.</p>
              ) : (
                <ul className="space-y-2">
                  {rvs.map((p) => (
                    <Row key={p.id} onDelete={() => deleteProfile(p.id).then((ok) => ok && setRvs((x) => x.filter((y) => y.id !== p.id)))}>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.label}</div>
                      <div className="text-[10px] text-slate-400">
                        {[p.model_year, p.make, p.model].filter(Boolean).join(" ")}{p.vin ? ` · VIN ${p.vin}` : ""}
                      </div>
                      <button onClick={() => onAsk(rvQuestion(p))} className="mt-1 text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400">Ask about this RV →</button>
                    </Row>
                  ))}
                </ul>
              )}
            </div>
          ) : searches.length === 0 ? (
            <p className="text-sm text-slate-400">No saved searches yet. Use “☆ Save” under any answer.</p>
          ) : (
            <ul className="space-y-2">
              {searches.map((s) => (
                <Row key={s.id} onDelete={() => deleteSearch(s.id).then((ok) => ok && setSearches((x) => x.filter((y) => y.id !== s.id)))}>
                  <button onClick={() => s.query && onAsk(s.query)} className="block w-full text-left">
                    <div className="line-clamp-2 text-xs font-medium text-slate-700 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-300">{s.label}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{new Date(s.created_at).toLocaleDateString()}</div>
                  </button>
                </Row>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
