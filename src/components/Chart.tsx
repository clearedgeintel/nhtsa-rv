import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ChartSpec } from "../types";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed"];

/** Render a bar/line chart from an agent-provided spec. Coerces y values to numbers. */
export function Chart({ spec }: { spec: ChartSpec }) {
  const { type, title, x_key, y_keys, data } = spec;
  if (!data?.length || !y_keys?.length) return null;

  const rows = data.map((r) => {
    const out: Record<string, string | number> = { ...r };
    for (const k of y_keys) out[k] = Number(r[k] ?? 0);
    return out;
  });

  // slate-500 tick labels read well on both light and dark cards; slate-400 axis line.
  const axisProps = { tick: { fontSize: 11, fill: "#64748b" }, stroke: "#94a3b8" } as const;

  return (
    <figure className="my-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <figcaption className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{title}</figcaption>
      <ResponsiveContainer width="100%" height={260}>
        {type === "line" ? (
          <LineChart data={rows} margin={{ top: 5, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={x_key} {...axisProps} angle={-25} textAnchor="end" height={50} interval={0} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} />
            {y_keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {y_keys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={2} isAnimationActive={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={rows} margin={{ top: 5, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={x_key} {...axisProps} angle={-25} textAnchor="end" height={50} interval={0} />
            <YAxis {...axisProps} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12 }} cursor={{ fill: "#f1f5f9" }} />
            {y_keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
            {y_keys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}
