// Measuring a change: the days it ran, against the same days replayed without it. The simulator is
// deterministic and draws each order from a stream of its own (server/simulator/day.ts), so the
// replay is the same guests ordering the same things, and the only differences are the change's.
// A real shop can't do this; it would hold a week out and live with the noise. The page says so.
//
// Only the simulated orders are compared. Visitors' orders are the same in both weeks (no lever
// writes them), so they would only water the difference down.

import type { ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { leversOn, LEVERS, simulateDay, staffHours, type LeverId, type SimOrder } from "@/server/simulator";

export interface Arm {
  orders: number;
  takingsCents: number;
  /** the median wait and the slowest one in ten, placed to ready, in seconds */
  waitP50: number;
  waitP90: number;
  /** the same two waits in the hours the lever touches only, when it touches only some */
  hoursWaitP50: number | null;
  hoursWaitP90: number | null;
  staffHours: number;
}

export interface Effect {
  /** the days measured, first to last */
  from: ShopDate;
  to: ShopDate;
  days: number;
  with: Arm;
  without: Arm;
}

const quantile = (sorted: readonly number[], p: number) => {
  if (sorted.length === 0) return 0;
  const at = p * (sorted.length - 1);
  const lo = Math.floor(at);
  return sorted[lo]! + (sorted[Math.min(lo + 1, sorted.length - 1)]! - sorted[lo]!) * (at - lo);
};

const hourOf = (d: Date) => Number(d.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }));
const waitOf = (o: SimOrder) => (o.readyAt.getTime() - o.placedAt.getTime()) / 1000;

function arm(orders: readonly SimOrder[], staff: number, hours: readonly [number, number] | null): Arm {
  const waits = orders.map(waitOf).sort((a, b) => a - b);
  const inHours = hours ? orders.filter((o) => hourOf(o.placedAt) >= hours[0] && hourOf(o.placedAt) < hours[1]).map(waitOf).sort((a, b) => a - b) : null;
  return {
    orders: orders.length,
    takingsCents: orders.reduce((s, o) => s + o.subtotalCents, 0),
    waitP50: Math.round(quantile(waits, 0.5)),
    waitP90: Math.round(quantile(waits, 0.9)),
    hoursWaitP50: inHours ? Math.round(quantile(inHours, 0.5)) : null,
    hoursWaitP90: inHours ? Math.round(quantile(inHours, 0.9)) : null,
    staffHours: staff,
  };
}

/**
 * The effect of `lever` over `days`. The "with" week is each day as the simulator wrote it (its
 * levers are read back from sim_days, so it is what the shop's figures show); the "without" week
 * is the same days with that one lever taken out and everything else left in.
 */
export async function measure(db: Db, lever: LeverId, days: readonly ShopDate[]): Promise<Effect | null> {
  if (days.length === 0) return null;
  const hours = LEVERS[lever].hours;
  const on: SimOrder[] = [];
  const off: SimOrder[] = [];
  let staffOn = 0;
  let staffOff = 0;
  for (const day of days) {
    const written = await leversOn(db, day);
    const withIt = written.includes(lever) ? written : [...written, lever]; // a day written before the plan caught up still counts as tried
    const without = withIt.filter((l) => l !== lever);
    on.push(...simulateDay(day, withIt).orders);
    off.push(...simulateDay(day, without).orders);
    staffOn += staffHours(withIt);
    staffOff += staffHours(without);
  }
  return { from: days[0]!, to: days.at(-1)!, days: days.length, with: arm(on, staffOn, hours), without: arm(off, staffOff, hours) };
}

/** The change as a fraction of the "without" figure: -0.08 is 8% lower. Zero when there's nothing to compare. */
export const change = (withIt: number, without: number) => (without === 0 ? 0 : (withIt - without) / without);
