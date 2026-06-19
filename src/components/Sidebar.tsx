import { useEffect, useMemo, useState } from "react";
import { getDashboard } from "../api";
import type { Dashboard } from "../types";
import { NewsCard } from "./NewsFeed";

/** A dependency-free SVG sparkline of recalls per year. */
function Sparkline({ points }: { points: { year: number; recalls: number }[] }) {
  const recent = points.slice(-12);
  const w = 240;
  const h = 48;
  const pad = 4;
  const { max, path, last } = useMemo(() => {
    const max = Math.max(1, ...recent.map((p) => p.recalls));
    const n = recent.length;
    const x = (i: number) => pad + (n <= 1 ? 0 : (i * (w - 2 * pad)) / (n - 1));
    const y = (v: number) => h - pad - (v / max) * (h - 2 * pad);
    const path = recent.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.recalls).toFixed(1)}`).join(" ");
    return { max, path, last: recent[n - 1] };
  }, [recent]);

  if (recent.length === 0) return <p className="text-xs text-slate-400">No data.</p>;
  const fillPath = `${path} L${(w - pad).toFixed(1)},${h - pad} L${pad},${h - pad} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Recalls per year">
        <path d={fillPath} fill="rgb(16 185 129 / 0.12)" />
        <path d={path} fill="none" stroke="rgb(16 185 129)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{recent[0]?.year}</span>
        <span className="text-slate-500 dark:text-slate-400">
          peak {max.toLocaleString()} · {last?.year}: {last?.recalls.toLocaleString()}
        </span>
        <span>{last?.year}</span>
      </div>
    </div>
  );
}

/** A compact clickable list with a thin proportional bar. */
function MiniList({
  rows,
  onPick,
  active,
  title,
}: {
  rows: { name: string; n: number }[];
  onPick: (name: string) => void;
  active?: string | null;
  title?: (name: string) => string;
}) {
  const max = rows[0]?.n ?? 1;
  if (rows.length === 0) return <p className="text-xs text-slate-400">No data.</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const isActive = active === r.name;
        return (
          <li key={r.name}>
            <button
              onClick={() => onPick(r.name)}
              className={
                "group w-full rounded-md px-1.5 py-1 text-left transition hover:bg-emerald-50 dark:hover:bg-emerald-900/20 " +
                (isActive ? "bg-emerald-50 ring-1 ring-emerald-300 dark:bg-emerald-900/30 dark:ring-emerald-700" : "")
              }
              title={title ? title(r.name) : `Ask about ${r.name}`}
            >
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span
                  className={
                    "truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 " +
                    (isActive ? "font-semibold text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-slate-200")
                  }
                >
                  {r.name}
                </span>
                <span className="shrink-0 font-mono text-slate-400">{r.n.toLocaleString()}</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-emerald-500/70 transition-[width] duration-500 ease-out"
                  style={{ width: `${(r.n / max) * 100}%` }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

/** Persistent left-rail dashboard. Clicking a make focuses the trend + components on it;
 *  clicking the trend or a component asks the agent a scoped question. */
export function Sidebar({ onAsk, onSeeNews }: { onAsk: (q: string) => void; onSeeNews: () => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [makes, setMakes] = useState<{ make_canonical: string; recalls: number }[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refetch the trend + components whenever the focused make changes.
  useEffect(() => {
    setLoading(true);
    getDashboard(focus).then((d) => {
      if (!d) return setLoading(false);
      setData(d);
      // The makes picker is global; keep the first (unfocused) load's list stable.
      setMakes((prev) => (prev.length ? prev : d.makes));
      setLoading(false);
    });
  }, [focus]);

  const scope = focus ?? "all RV";
  const trendQ = focus
    ? `How have ${focus} recalls trended over the years?`
    : "How have RV recalls trended over the last 10 years?";

  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 dark:border-slate-700 dark:bg-slate-800 lg:block">
      <div className="space-y-5">
        <div className="border-b border-slate-100 pb-4 dark:border-slate-700/60">
          <NewsCard onSeeAll={onSeeNews} />
        </div>

        {/* Focus banner */}
        {focus && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5 ring-1 ring-emerald-200 dark:bg-emerald-900/25 dark:ring-emerald-800">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">Focused on</div>
              <div className="truncate text-xs font-semibold text-emerald-800 dark:text-emerald-200">{focus}</div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={() => onAsk(`Summarize the recalls and complaints for ${focus}.`)}
                title={`Ask about ${focus}`}
                className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700"
              >
                Ask →
              </button>
              <button
                onClick={() => setFocus(null)}
                title="Clear focus"
                className="rounded px-1 text-xs text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-800/40"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className={"space-y-5 transition-opacity duration-300 " + (loading ? "opacity-50" : "opacity-100")}>
          <Section title={focus ? `${focus} recall trend` : "Recall trend"}>
            <button
              onClick={() => onAsk(trendQ)}
              className="w-full rounded-lg p-1 transition hover:bg-slate-50 dark:hover:bg-slate-700/40"
              title={`Ask about the ${scope} recall trend`}
            >
              <Sparkline points={data?.trend ?? []} />
            </button>
          </Section>

          <Section title={focus ? `${focus} — top components` : "Top defect components"}>
            <MiniList
              rows={(data?.components ?? []).slice(0, 8).map((c) => ({ name: c.component, n: c.n }))}
              title={(name) =>
                focus ? `Ask about ${name} on ${focus}` : `Ask which makes have the most ${name} complaints`
              }
              onPick={(name) =>
                onAsk(
                  focus
                    ? `What are the most common ${name.toLowerCase()} complaints for ${focus}?`
                    : `Which RV makes have the most ${name.toLowerCase()} complaints?`,
                )
              }
            />
          </Section>
        </div>

        <Section title="Top makes by recalls">
          <p className="-mt-1 mb-1.5 text-[10px] text-slate-400">Click to focus the dashboard.</p>
          <MiniList
            rows={makes.slice(0, 8).map((m) => ({ name: m.make_canonical, n: m.recalls }))}
            active={focus}
            title={(name) => (focus === name ? "Clear focus" : `Focus the dashboard on ${name}`)}
            onPick={(name) => setFocus((cur) => (cur === name ? null : name))}
          />
        </Section>

        <p className="border-t border-slate-100 pt-3 text-[10px] leading-snug text-slate-400 dark:border-slate-700/60">
          Live aggregates over the NHTSA RV slice. Click a make to focus; click the trend or a component to ask.
        </p>
      </div>
    </aside>
  );
}
