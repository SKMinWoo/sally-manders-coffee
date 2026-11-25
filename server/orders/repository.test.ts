import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "@/server/platform/db/client";
import { testDb } from "@/server/platform/db/test-db";
import { ensureDays, simulateDay } from "@/server/simulator";
import { countOrders, countPlacedBetween, listFootfall } from "./repository";

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

test("footfall is the stored orders in the window, oldest first, and never one from the future", async () => {
  const noon = sim.orders.find((o) => o.placedAt.getUTCHours() === 18)!.placedAt;
  const from = new Date(+noon - 15 * 60_000);
  const want = sim.orders.filter((o) => o.placedAt > from && o.placedAt <= noon);
  assert.ok(want.length > 1, "a quarter hour at noon has guests");

  const got = await listFootfall(db, from, noon);
  assert.deepEqual(
    got.map((g) => [+g.placedAt, +g.readyAt, g.items, g.source]),
    want.map((o) => [+o.placedAt, +o.readyAt, o.lines.reduce((s, l) => s + l.qty, 0), "sim"]),
  );
  assert.ok(got.every((g) => g.placedAt <= noon), "nothing placed after asOf");
  assert.deepEqual(Object.keys(got[0]!).sort(), ["items", "placedAt", "readyAt", "source"], "no ids, lines or visitor hash");

  const next = sim.orders.find((o) => o.placedAt > noon)!;
  const later = await listFootfall(db, noon, next.placedAt);
  assert.equal(later.length, sim.orders.filter((o) => o.placedAt > noon && o.placedAt <= next.placedAt).length);
  assert.deepEqual(await listFootfall(db, noon, noon), [], "an empty window is empty");
});
