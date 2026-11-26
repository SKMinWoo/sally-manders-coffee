import { formatMoney } from "@/lib/money";
import { formatWait } from "@/lib/time";
import type { DaySummary } from "@/server/reporting";

export type MetricKey = "sales" | "orders" | "avgCheck" | "waitP50" | "waitP95" | "visitorOrders";

export interface Metric {
  label: string;
  /** the figure, or null when there's nothing to measure yet */
  value: (d: DaySummary) => number | null;
  format: (n: number) => string;
  /** for a wait, down is good */
  lowerIsBetter?: boolean;
}

export const METRICS: Record<MetricKey, Metric> = {
  sales: { label: "Takings", value: (d) => d.salesCents, format: (n) => formatMoney(n, { whole: true }) },
  orders: { label: "Orders", value: (d) => d.orders, format: (n) => n.toLocaleString("en-US") },
  avgCheck: { label: "Average check", value: (d) => (d.orders ? Math.round(d.salesCents / d.orders) : null), format: (n) => formatMoney(n) },
  waitP50: { label: "Typical wait", value: (d) => d.waitP50, format: formatWait, lowerIsBetter: true },
  waitP95: { label: "Slowest 1 in 20", value: (d) => d.waitP95, format: formatWait, lowerIsBetter: true },
  visitorOrders: { label: "Ordered here", value: (d) => d.visitorOrders, format: (n) => n.toLocaleString("en-US") },
};

// The three figures that head the rail, pinned up big with last week beside them (decision 0009,
// proposed): takings and orders say "busy", and the slowest 1 in 20 waits says "and it's run
// well", which is the p95 a performance reviewer looks for. The other three sit underneath.
export const LEAD_METRICS: [MetricKey, MetricKey, MetricKey] = ["sales", "orders", "waitP95"];

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const clock = (hour: number, minute: number) =>
  `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;

/** "▲ 12% up on last Saturday ($1,204)", or a word when there's no fair comparison. */
export function versus(key: MetricKey, today: number | null, last: number | null, weekday: string) {
  if (today === null || last === null || last === 0) return `No figures for last ${weekday} yet`;
  const m = METRICS[key];
  const pct = Math.round(((today - last) / last) * 100);
  if (pct === 0) return `Level with last ${weekday} (${m.format(last)})`;
  // the arrow says better or worse; the word says which way the number moved
  const better = m.lowerIsBetter ? pct < 0 : pct > 0;
  const moved = m.lowerIsBetter ? (pct > 0 ? "slower than" : "faster than") : pct > 0 ? "up on" : "down on";
  return `${better ? "▲" : "▼"} ${Math.abs(pct)}% ${moved} last ${weekday} (${m.format(last)})`;
}
