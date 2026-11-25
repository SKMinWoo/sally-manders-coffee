// The board: the morning calls (a regular, then the manager), the changes the manager tries, and
// the measurement that keeps or takes back each one. Depends on the simulator (its levers, and
// replaying days without one), reporting and the menu (the figures), and the brief (the model,
// the guard). The simulator doesn't depend on it: the board hands the simulate job a plan.

import { unstable_cache } from "next/cache";
import { shopDb } from "@/server/platform/db/client";
import { now, stoppedAt } from "@/server/platform/clock";
import { boardView } from "./view";

export { leverPlan, TRIAL_DAYS, COOL_OFF_DAYS } from "./plan";
export { REGULARS, regularFor, type Regular } from "./regulars";
export { runStandup, type StandupConfig, type StandupReport } from "./standup";
export { rehearse } from "./rehearse";
export { boardView, lineOf, HEARD_DAYS, type Board, type BoardLine, type Card, type Heard, type Morning, type Next, type Standing } from "./view";
export { BOARD_SOURCE, inProse } from "./figures";
export type { Call, CustomerCall, ManagerCall, Experiment } from "./repository";
export type { Effect, Arm } from "./measure";
export type { Deltas } from "./verdict";

/** The board, cached five minutes: it changes once a morning. */
export const getBoard = unstable_cache(async () => boardView(await shopDb(), now()), ["board", stoppedAt()], { revalidate: 300 });
