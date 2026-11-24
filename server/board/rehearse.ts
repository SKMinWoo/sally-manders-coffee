// A fortnight of mornings, run in a few seconds, for a database that has never had one: the local
// dev database and the browser tests' own. It does exactly what production does each day, in
// order (the standup at 08:30 UTC, then the simulator writing today and tomorrow with the plan),
// with the templates writing every call, so the board opens with a change measured and another
// being tried. Production never runs this: its board starts empty and fills a morning at a time.

import { addDays, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { ensureDays, writtenDays } from "@/server/simulator";
import { leverPlan } from "./plan";
import { callsSince } from "./repository";
import { daysFrom, runStandup } from "./standup";

/** The standup's hour, in UTC, on `day`: 2:30 am in Austin in winter, 3:30 in summer. */
const standupAt = (day: ShopDate) => new Date(`${day}T08:30:00Z`);

/** True when it ran; false when the database already had days or calls of its own. */
export async function rehearse(db: Db, now: Date, mornings = 14): Promise<boolean> {
  const today = shopToday(now);
  const start = addDays(today, -mornings);
  if ((await writtenDays(db, [addDays(start, -1), start])).size > 0) return false;
  if ((await callsSince(db, addDays(start, -1))).length > 0) return false;

  // the week before the first morning, written plainly, so the first call has a yesterday to talk about
  await ensureDays(db, daysFrom(addDays(start, -8), start));
  for (const day of daysFrom(start, today)) {
    await runStandup(db, standupAt(day));
    await ensureDays(db, [day, addDays(day, 1)], leverPlan(db));
  }
  return true;
}
