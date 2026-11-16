// The figures a brief may use: one complete Austin day, set against the same weekday a week
// before. Each has a key the writer puts where the figure goes, the words it's shown in, and the
// API path it comes from, so a reader can follow any number in a brief back to its source.

import { formatMoney } from "@/lib/money";
import { addDays, formatCheckDate, formatWait, hoursOf, weekdayOf, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { daySummary, itemsSold, ordersByHour } from "@/server/reporting";

export type BriefFigure = {
  /** what the writer puts in braces where the figure goes: {orders} */
  key: string;
  /** what the figure is, for the writer and for a reader hovering it */
  label: string;
  /** the figure, the way the brief prints it: "$1,552", "7 am", "down 5%" */
  display: string;
  /** the API path it comes from: /api/v1/days/2026-11-12 */
  source: string;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The instant an Austin day is over: the first hour of the next one. */
export const endOf = (day: ShopDate): Date => hoursOf(addDays(day, 1))[0]!.start;

const count = (n: number) => n.toLocaleString("en-US");
const clockHour = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

/** "up 5%", "down 12%", "level"; for a wait, "8% quicker" or "3% slower". Null with nothing to compare. */
function change(now: number | null, then: number | null, wait = false): string | null {
  if (now === null || then === null || then === 0) return null;
  const pct = Math.round(((now - then) / then) * 100);
  if (pct === 0) return "level";
  if (wait) return pct < 0 ? `${-pct}% quicker` : `${pct}% slower`;
  return pct > 0 ? `up ${pct}%` : `down ${-pct}%`;
}

const figure = (key: string, label: string, display: string | null, source: string): BriefFigure | null =>
  display === null ? null : { key, label, display, source };

/** Every figure for a complete day; one with nothing to say (no orders a week ago) is left out. */
export async function dayFigures(db: Db, day: ShopDate): Promise<BriefFigure[]> {
  const before = addDays(day, -7);
  const [d, w, hours, items] = await Promise.all([
    daySummary(db, day, endOf(day)),
    daySummary(db, before, endOf(before)),
    ordersByHour(db, day, endOf(day)),
    itemsSold(db, day, endOf(day)),
  ]);
  const summary = `/api/v1/days/${day}`;
  const lastWeek = `/api/v1/days/${before}`;
  const peak = hours.reduce<(typeof hours)[number] | null>((best, h) => (!best || h.orders > best.orders ? h : best), null);
  const top = items[0];

  const all: (BriefFigure | null)[] = [
    { key: "weekday", label: "The day of the week the brief is about", display: WEEKDAYS[weekdayOf(day)]!, source: summary },
    { key: "date", label: "The date the brief is about", display: formatCheckDate(day), source: summary },
    { key: "orders", label: "Orders over the whole day", display: count(d.orders), source: summary },
    figure("ordersChange", "Orders against the same weekday a week before", change(d.orders, w.orders), lastWeek),
    { key: "takings", label: "Takings, before tax", display: formatMoney(d.salesCents, { whole: true }), source: summary },
    figure("takingsChange", "Takings against the same weekday a week before", change(d.salesCents, w.salesCents), lastWeek),
    figure("averageCheck", "The average check", d.orders ? formatMoney(Math.round(d.salesCents / d.orders)) : null, summary),
    figure("typicalWait", "The typical wait, order to ready (the median)", d.waitP50 === null ? null : formatWait(d.waitP50), summary),
    figure("longestWaits", "The longest waits (the slowest one order in twenty)", d.waitP95 === null ? null : formatWait(d.waitP95), summary),
    figure("longestWaitsChange", "The longest waits against a week before", change(d.waitP95, w.waitP95, true), lastWeek),
    peak && { key: "busiestHour", label: "The busiest hour", display: clockHour(peak.hour), source: `${summary}/hours` },
    peak && { key: "busiestHourOrders", label: "Orders in the busiest hour", display: count(peak.orders), source: `${summary}/hours` },
    top ? { key: "topItem", label: "What sold most", display: top.name, source: `${summary}/items` } : null,
    top ? { key: "topItemSold", label: "How many of it sold", display: count(top.qty), source: `${summary}/items` } : null,
    { key: "visitorOrders", label: "Orders placed by visitors to the site (the rest are simulated)", display: count(d.visitorOrders), source: summary },
  ];
  return all.filter((f): f is BriefFigure => f !== null);
}
