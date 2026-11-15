import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "@/server/platform/db/client";
import { testDb } from "@/server/platform/db/test-db";
import { ensureDays, simulateDay } from "@/server/simulator";
import { countOrders, countPlacedBetween } from "./repository";

let db: Db, close: () => Promise<void>;
before(async () => {
  ({ db, close } = await testDb());
  await ensureDays(db, [DAY]);
});
after(() => close());

const DAY = "2026-11-13";
const sim = simulateDay(DAY);

test("orders that haven't happened yet are invisible", async () => {
  const noon = sim.orders.find((o) => o.placedAt.getUTCHours() === 18)!.placedAt; // noon in Austin (CST)
  const upToNoon = sim.orders.filter((o) => o.placedAt <= noon).length;
  const atNoon = sim.orders.filter((o) => +o.placedAt === +noon).length;
  assert.ok(upToNoon > 0 && upToNoon < sim.orders.length);
  assert.equal(await countOrders(db, DAY, noon), upToNoon);
  assert.equal(await countOrders(db, DAY, new Date(+noon - 1)), upToNoon - atNoon);
  assert.equal(await countOrders(db, DAY, new Date(`${DAY}T05:59:59Z`)), 0, "nothing before the day starts");

  const hourAgo = new Date(+noon - 3_600_000);
  const lastHour = sim.orders.filter((o) => o.placedAt > hourAgo && o.placedAt <= noon).length;
  assert.equal(await countPlacedBetween(db, hourAgo, noon), lastHour);
  assert.equal(await countPlacedBetween(db, hourAgo, hourAgo), 0, "an empty window is empty");
});
