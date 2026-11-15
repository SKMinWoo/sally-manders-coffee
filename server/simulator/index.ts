// The simulator: the shop's regulars and its baristas. It writes each day ahead of time, seeded by
// the date, so a day is the same however often it is written (docs/decisions/0002). Depends on
// the menu, for what there is to order.

export { simulateDay, waitSeconds } from "./day";
export { capacityAt } from "./demand";
export { writtenDays } from "./repository";
export { backfillDays, daysAhead, ensureDays } from "./run";
