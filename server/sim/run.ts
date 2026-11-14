import { addDays, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/db/client";
import { syncMenu } from "@/server/db/repositories/menu";
import { writeSimDay, writtenDays } from "@/server/db/repositories/orders";
import { simulateDay } from "./day";

export interface RunReport {
  written: ShopDate[];
  already: ShopDate[];
}

/** Makes sure the simulator has written each of these days. Days already written are left alone. */
export async function ensureDays(db: Db, days: ShopDate[]): Promise<RunReport> {
  await syncMenu(db);
  const have = await writtenDays(db, days);
  const report: RunReport = { written: [], already: [...have].sort() };
  for (const day of days) {
    if (have.has(day)) continue;
    if ((await writeSimDay(db, simulateDay(day))) === "written") report.written.push(day);
    else report.already.push(day);
  }
  return report;
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
