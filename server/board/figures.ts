// The figures the morning calls may use. Same rule as the brief (server/brief/guard.ts): a writer
// puts {key} where a number goes, and every figure is the database's or the measurement's, with
// the API path a reader can check it against.

import { formatWait, weekdayOf, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { endOf, type BriefFigure } from "@/server/brief";
import { MENU } from "@/server/menu";
import { daySummary, ordersByHour } from "@/server/reporting";
import { LEVERS, type LeverId } from "@/server/simulator";
import type { Effect } from "./measure";
import type { Regular } from "./regulars";
import { deltas } from "./verdict";

export type Figure = BriefFigure;

export const BOARD_SOURCE = "/api/v1/board";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const clockHour = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
export const weekdayName = (day: ShopDate) => WEEKDAYS[weekdayOf(day)]!;

/** A change's name as it reads mid-sentence: "I noticed a pickup shelf", not "A pickup shelf". */
export const inProse = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

/** "9% quicker", "4% slower", "level" */
export function waitWords(fraction: number): string {
  const pct = Math.round(fraction * 100);
  return pct === 0 ? "level" : pct < 0 ? `${-pct}% quicker` : `${pct}% slower`;
}

/** "up 3%", "down 2%", "level" */
export function changeWords(fraction: number): string {
  const pct = Math.round(fraction * 100);
  return pct === 0 ? "level" : pct > 0 ? `up ${pct}%` : `down ${-pct}%`;
}

/** What the regular saw on their visit: the numbers behind their note, and the raw ones the template reasons with. */
export interface Visit {
  figures: Figure[];
  /** seconds, for the template's judgement; null when nobody came in that hour */
  waitInHour: number | null;
  typicalWait: number | null;
  ordersInHour: number;
}

export async function visitFigures(db: Db, day: ShopDate, r: Regular): Promise<Visit> {
  const [hours, s] = await Promise.all([ordersByHour(db, day, endOf(day)), daySummary(db, day, endOf(day))]);
  const h = hours.find((x) => x.hour === r.hour);
  const usual = MENU.find((m) => m.id === r.usual)!;
  const summary = `/api/v1/days/${day}`;
  const figures: (Figure | null)[] = [
    { key: "weekday", label: "The day of the week of the visit", display: weekdayName(day), source: summary },
    { key: "visitHour", label: "When the regular came in", display: clockHour(r.hour), source: `${summary}/hours` },
    { key: "ordersInHour", label: "Orders in the hour the regular came in", display: String(h?.orders ?? 0), source: `${summary}/hours` },
    h ? { key: "waitInHour", label: "The typical wait in that hour", display: formatWait(h.waitP50Seconds), source: `${summary}/hours` } : null,
    s.waitP50 === null ? null : { key: "typicalWait", label: "The typical wait over the whole day", display: formatWait(s.waitP50), source: summary },
    { key: "usual", label: "What the regular always has", display: usual.name, source: "/api/v1/menu" },
  ];
  return {
    figures: figures.filter((f): f is Figure => f !== null),
    waitInHour: h?.waitP50Seconds ?? null,
    typicalWait: s.waitP50,
    ordersInHour: h?.orders ?? 0,
  };
}

/** The change being tried, and how it's doing so far. */
export function trialFigures(lever: LeverId, dayOfTrial: number, trialDays: number, soFar: Effect | null): Figure[] {
  const d = soFar ? deltas(soFar) : null;
  const f: (Figure | null)[] = [
    { key: "trialName", label: "The change being tried this week", display: inProse(LEVERS[lever].name), source: BOARD_SOURCE },
    { key: "trialDay", label: "How many of its days are done", display: `${dayOfTrial} of ${trialDays} days in`, source: BOARD_SOURCE },
    d && { key: "trialWait", label: "The typical wait so far, against the same days without it, in the hours it touches", display: waitWords(d.wait), source: BOARD_SOURCE },
    d && { key: "trialTakings", label: "Takings so far, against the same days without it", display: changeWords(d.takings), source: BOARD_SOURCE },
  ];
  return f.filter((x): x is Figure => x !== null && x !== undefined);
}

/** A change chosen but not yet in: its name and its first day. */
export function plannedFigures(lever: LeverId, startsOn: ShopDate): Figure[] {
  return [
    { key: "trialName", label: "The change chosen to try next", display: inProse(LEVERS[lever].name), source: BOARD_SOURCE },
    { key: "trialStarts", label: "The first day it's in", display: weekdayName(startsOn), source: BOARD_SOURCE },
  ];
}

/** A change that has just run its week, and what it came to. */
export function verdictFigures(lever: LeverId, effect: Effect, kept: boolean): Figure[] {
  const d = deltas(effect);
  return [
    { key: "measuredName", label: "The change that just ran its week", display: inProse(LEVERS[lever].name), source: BOARD_SOURCE },
    { key: "measuredWait", label: "Its typical wait, against the same week without it", display: waitWords(d.wait), source: BOARD_SOURCE },
    { key: "measuredTakings", label: "Its takings, against the same week without it", display: changeWords(d.takings), source: BOARD_SOURCE },
    { key: "measuredVerdict", label: "What the measurement decided", display: kept ? "kept" : "taken back", source: BOARD_SOURCE },
  ];
}

/** Merges figure lists; the first list to give a key wins (they agree anyway: same day, same database). */
export function merge(...lists: readonly Figure[][]): Figure[] {
  const seen = new Set<string>();
  return lists.flat().filter((f) => (seen.has(f.key) ? false : (seen.add(f.key), true)));
}
