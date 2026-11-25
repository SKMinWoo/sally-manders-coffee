import { shopClock } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { countPlacedBetween } from "./repository";
import { capacityAt, leversOn, tuning, waitSeconds } from "@/server/simulator";

const HOUR_MS = 3_600_000;

/** How fast the bar works today: the seconds before the first item and for each one, with today's levers in. */
export type Pace = { baseSeconds: number; itemSeconds: number };

/**
 * How hard the bar is working right now: orders in the last hour over what this hour's crew can
 * make, and the bar's pace. Both follow the levers the simulator wrote today with (server/board),
 * so a visitor's estimate agrees with the shop the simulated guests are queueing in.
 */
export async function loadNow(db: Db, now: Date): Promise<{ load: number; pace: Pace }> {
  const { date, hour } = shopClock(now);
  const [recent, levers] = await Promise.all([countPlacedBetween(db, new Date(+now - HOUR_MS), now), leversOn(db, date)]);
  const t = tuning(levers);
  return { load: recent / t.capacity(hour, capacityAt(hour)), pace: { baseSeconds: t.baseSeconds, itemSeconds: t.itemSeconds } };
}

/** The wait a new order of `items` can expect: the simulator's model at today's load, without its luck. */
export function expectedWait(items: number, load: number, pace?: Pace): number {
  return waitSeconds({ items, load, noise: 0, ...pace });
}
