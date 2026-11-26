// The verdict on a week's trial: keep the change, or take it back. Code decides, not the model:
// the manager proposes, the measurement is arithmetic, and this rule is the shop's policy.

import { LEVERS, type LeverId } from "@/server/simulator";
import { change, type Effect } from "./measure";
import type { Verdict } from "./repository";

/** The effect as fractions of the week without the change (-0.08 is 8% lower), and barista hours as a count. */
export function deltas(e: Effect) {
  const wait = e.with.hoursWaitP50 !== null && e.without.hoursWaitP50 !== null ? change(e.with.hoursWaitP50, e.without.hoursWaitP50) : change(e.with.waitP50, e.without.waitP50);
  const slow = e.with.hoursWaitP90 !== null && e.without.hoursWaitP90 !== null ? change(e.with.hoursWaitP90, e.without.hoursWaitP90) : change(e.with.waitP90, e.without.waitP90);
  return {
    /** typical wait, in the hours the change touches when it touches only some */
    wait,
    /** the slowest waits (one in ten), likewise */
    slow,
    orders: change(e.with.orders, e.without.orders),
    takings: change(e.with.takingsCents, e.without.takingsCents),
    /** extra barista hours a day */
    staffHoursPerDay: (e.with.staffHours - e.without.staffHours) / e.days,
  };
}

export type Deltas = ReturnType<typeof deltas>;

/**
 * Whether a change that ran its week stays. The shop's policy (decision 0009, proposed):
 *
 *   - Better means the typical or the slowest wait fell by 3% or more, or takings rose by 1% or
 *     more. Below that it's noise on a simulated week.
 *   - Worse means the typical wait grew by over 5%, or takings fell by over 1%. Takings can't buy a
 *     much slower wait: the shop's promise is the wait.
 *   - A barista hour has to earn its keep: a change that adds hours must cut the typical wait in its
 *     hours by at least 5% for each extra hour a day. The third morning barista (three hours) has to
 *     find 15%; a second evening barista (two hours) has to find 10%.
 */
export function shouldKeep(d: Deltas, lever: LeverId): boolean {
  const better = d.wait <= -0.03 || d.slow <= -0.03 || d.takings >= 0.01;
  const worse = d.wait > 0.05 || d.takings < -0.01;
  const hours = Math.max(d.staffHoursPerDay, LEVERS[lever].staffHours);
  const earnsItsHours = hours <= 0 || d.wait <= -0.05 * hours;
  return better && !worse && earnsItsHours;
}

export const verdictOf = (e: Effect, lever: LeverId): Verdict => (shouldKeep(deltas(e), lever) ? "kept" : "rolled-back");
