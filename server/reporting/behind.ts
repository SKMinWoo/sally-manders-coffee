// What Behind the scenes reads: today so far, and the same weekday last week up to the same
// time, so the comparison is fair at 9 am as well as at 9 pm. Cached a minute, like the pulse.

import { unstable_cache } from "next/cache";
import { addDays, sameTimeDaysBefore, shopClock, type ShopDate } from "@/lib/time";
import { shopDb } from "@/server/platform/db/client";
import { daySummary, itemsSold, ordersByHour, type DaySummary, type ItemSold } from "./metrics";
import { daypartOf, DAYPARTS, type Daypart } from "@/server/menu";
import { now, stoppedAt } from "@/server/platform/clock";

export interface Behind {
  /** the instant the figures were read (they're cached a minute) */
  asOf: number;
  date: ShopDate;
  /** Austin clock hour and minute the figures run to */
  hour: number;
  minute: number;
  today: DaySummary;
  lastWeek: DaySummary;
  lastWeekDate: ShopDate;
  /** orders in each Austin hour, 0–23; hours still to come are null */
  hours: (number | null)[];
  /** the same weekday last week, every hour of it: the shape today is heading for */
  lastWeekHours: number[];
  peakHour: number | null;
  dayparts: { name: Daypart; orders: number }[];
  top: ItemSold[];
}

export async function readBehind(now: Date): Promise<Behind> {
  const db = await shopDb();
  const { date, hour, minute } = shopClock(now);
  const lastWeekDate = addDays(date, -7);
  const [today, lastWeek, byHour, lastWeekByHour, items] = await Promise.all([
    daySummary(db, date, now),
    daySummary(db, lastWeekDate, sameTimeDaysBefore(now, 7)),
    ordersByHour(db, date, now),
    // as of now, which is after the whole of that day: so all of it
    ordersByHour(db, lastWeekDate, now),
    itemsSold(db, date, now),
  ]);

  const hours = Array.from({ length: 24 }, (_, h): number | null => (h <= hour ? 0 : null));
  for (const h of byHour) hours[h.hour] = h.orders;
  const lastWeekHours = Array.from({ length: 24 }, () => 0);
  for (const h of lastWeekByHour) lastWeekHours[h.hour] = h.orders;
  const peak = byHour.reduce<(typeof byHour)[number] | null>((best, h) => (!best || h.orders > best.orders ? h : best), null);

  const dayparts = DAYPARTS.map((name) => ({ name, orders: 0 }));
  for (const h of byHour) dayparts[daypartOf(h.hour)]!.orders += h.orders;

  return { asOf: now.getTime(), date, hour, minute, today, lastWeek, lastWeekDate, hours, lastWeekHours, peakHour: peak?.hour ?? null, dayparts, top: items.slice(0, 5) };
}

export const getBehind = unstable_cache(() => readBehind(now()), ["behind", stoppedAt()], { revalidate: 60 });
