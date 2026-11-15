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

// TODO(Alex): which three figures head the rail? They're pinned up big, with last week beside
// them; the other three sit underneath in small type. A café owner glancing in at 10 am wants
// different things from a recruiter reading the résumé: takings and orders say "busy", the p95
// wait says "and it's run well". Pick any three keys of METRICS, most important first.
export const LEAD_METRICS: [MetricKey, MetricKey, MetricKey] = ["sales", "orders", "waitP95"];
