// The simulator: the shop's regulars and its baristas. It writes each day ahead of time, seeded by
// the date, so a day is the same however often it is written (docs/decisions/0002). Depends on
// the menu, for what there is to order. The levers are the knobs the board may turn; which ones
// are in effect on a day is the board's to say, passed in as a plan.

export { simulateDay, waitSeconds, type SimDay, type SimOrder } from "./day";
export { capacityAt } from "./demand";
export { BASE_STAFF_HOURS, isLeverId, LEVER_IDS, LEVERS, staffHours, TOPICS, tuning, type Lever, type LeverId, type Topic } from "./levers";
export { leversOn, writtenDays } from "./repository";
export { backfillDays, daysAhead, ensureDays, firstUnwritten, type LeverPlan } from "./run";
