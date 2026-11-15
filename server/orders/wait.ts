import { shopClock } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { countPlacedBetween } from "./repository";
import { waitSeconds } from "@/server/simulator";
import { capacityAt } from "@/server/simulator";

const HOUR_MS = 3_600_000;

/** How hard the bar is working right now: orders in the last hour over what this hour's crew can make. */
export async function loadNow(db: Db, now: Date): Promise<number> {
  const recent = await countPlacedBetween(db, new Date(+now - HOUR_MS), now);
  return recent / capacityAt(shopClock(now).hour);
}

/** The wait a new order of `items` can expect: the simulator's model at today's load, without its luck. */
export function expectedWait(items: number, load: number): number {
  return waitSeconds({ items, load, noise: 0 });
}
