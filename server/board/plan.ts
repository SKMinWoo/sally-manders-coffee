// Which levers are in on a day, from the changes tried. A change is in from its first day for as
// long as it's live (its week, and the day or two after the week that are written before the
// verdict lands); a kept one stays in for good; a rolled-back one is in until the last day that was
// already written when the verdict came.

import { addDays, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import type { LeverId } from "@/server/simulator";
import { allExperiments, type Experiment } from "./repository";

/** A change runs a week, so every weekday is in it once. */
export const TRIAL_DAYS = 7;

/** After a change is rolled back, how long before it may be tried again. */
export const COOL_OFF_DAYS = 14;

export function inEffect(e: Experiment, day: ShopDate): boolean {
  if (day < e.startsOn) return false;
  if (e.status === "live" || e.verdict === "kept") return true;
  return e.until !== null && day <= e.until;
}

export function leversIn(all: readonly Experiment[], day: ShopDate): LeverId[] {
  return [...new Set(all.filter((e) => inEffect(e, day)).map((e) => e.lever))].sort();
}

/** The plan the simulator writes new days with (server/simulator's LeverPlan). */
export function leverPlan(db: Db) {
  let all: Promise<Experiment[]> | null = null;
  return async (day: ShopDate): Promise<LeverId[]> => leversIn(await (all ??= allExperiments(db)), day);
}

export const trialEnd = (startsOn: ShopDate) => addDays(startsOn, TRIAL_DAYS - 1);

/** Why a lever can't be tried now, or null when it can. */
export function unavailable(all: readonly Experiment[], lever: LeverId, today: ShopDate): string | null {
  if (all.some((e) => e.status === "live")) return "a change is already being tried, and they go one at a time";
  const mine = all.filter((e) => e.lever === lever);
  if (mine.some((e) => e.verdict === "kept")) return "it's already part of the shop";
  const last = mine.filter((e) => e.verdict === "rolled-back").at(-1);
  if (last?.measuredOn && today < addDays(last.measuredOn, COOL_OFF_DAYS)) return "it was taken back less than a fortnight ago";
  return null;
}
