import { addDays, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { syncMenu } from "@/server/menu";
import { writeSimDay, writtenDays } from "./repository";
import { simulateDay } from "./day";
import type { LeverId } from "./levers";

export interface RunReport {
  written: ShopDate[];
  already: ShopDate[];
}

/** Which levers are in effect on a day. The board decides (server/board); the simulator only asks. */
export type LeverPlan = (day: ShopDate) => Promise<readonly LeverId[]>;

const NO_LEVERS: LeverPlan = async () => [];

/**
 * Makes sure the simulator has written each of these days. Days already written are left alone.
 * `plan` says which levers each new day runs with; a day with none is simulated the original way.
 */
export async function ensureDays(db: Db, days: ShopDate[], plan: LeverPlan = NO_LEVERS): Promise<RunReport> {
  await syncMenu(db);
  const have = await writtenDays(db, days);
  const report: RunReport = { written: [], already: [...have].sort() };
  for (const day of days) {
    if (have.has(day)) continue;
    const levers = await plan(day);
    if ((await writeSimDay(db, simulateDay(day, levers.length ? levers : undefined))) === "written") report.written.push(day);
    else report.already.push(day);
  }
  return report;
}

/** The first day from `from` on that the simulator hasn't written: where a new lever can start. */
export async function firstUnwritten(db: Db, from: ShopDate): Promise<ShopDate> {
  for (let day = from; ; day = addDays(day, 1)) if (!(await writtenDays(db, [day])).has(day)) return day;
}

/** The daily job: today and tomorrow, so one missed run leaves no gap (docs/decisions/0002). */
export function daysAhead(now: Date = new Date()): ShopDate[] {
  const today = shopToday(now);
  return [today, addDays(today, 1)];
}

/** The last `n` days before today, oldest first, plus today and tomorrow. */
export function backfillDays(n: number, now: Date = new Date()): ShopDate[] {
  const today = shopToday(now);
  return [...Array.from({ length: n }, (_, i) => addDays(today, i - n)), ...daysAhead(now)];
}
