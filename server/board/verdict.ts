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
 * Whether a change that ran its week stays.
 *
 * TODO(Alex): this is the shop's policy, so it's yours to set. It decides what the board shows as
 * kept and what it shows as taken back, and every kept change becomes part of the shop for good.
 * The questions in it:
 *   - How much quicker must the wait get to be worth anything? Is a 2% gain noise to you?
 *   - What is a barista hour worth against the wait? The third barista costs three hours a day
 *     and only shortens the morning; a change that costs hours should probably have to earn them.
 *   - Can takings buy a slower wait (the pastry pairing raises checks but makes orders bigger)?
 * The rule below is a placeholder so the board runs: keep it when something got better (the wait
 * by 3% or more, or takings by 1% or more) and nothing got worse (the wait by over 5%, or takings
 * by over 1%). It ignores staff hours, so a change that costs hours and moves nothing is still
 * taken back only because nothing got better. Replace it with your rule (5 to 10 lines).
 */
export function shouldKeep(d: Deltas, lever: LeverId): boolean {
  void LEVERS[lever]; // the lever is here for a rule that weighs its cost (LEVERS[lever].staffHours)
  const better = d.wait <= -0.03 || d.slow <= -0.03 || d.takings >= 0.01;
  const worse = d.wait > 0.05 || d.takings < -0.01;
  return better && !worse;
}

export const verdictOf = (e: Effect, lever: LeverId): Verdict => (shouldKeep(deltas(e), lever) ? "kept" : "rolled-back");
