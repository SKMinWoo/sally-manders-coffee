import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { asc, count, eq, sql, sum } from "drizzle-orm";
import type { Db } from "../client";
import { orderLines, orders, simDays } from "../schema";
import { testDb } from "../test-db";
import { simulateDay } from "@/server/sim/day";
import { backfillDays, daysAhead, ensureDays } from "@/server/sim/run";
import { listMenu } from "./menu";
import { countOrders, countPlacedBetween, writeSimDay } from "./orders";

let db: Db, close: () => Promise<void>;
before(async () => ({ db, close } = await testDb()));
after(() => close());

const DAY = "2026-11-13";
const sim = simulateDay(DAY);
const publicIds = async () =>
  (await db.select({ id: orders.publicId }).from(orders).where(eq(orders.day, DAY)).orderBy(asc(orders.ticket))).map((r) => r.id);

test("a simulated day is written whole, and every cent reconciles in the database", async () => {
  assert.deepEqual(await ensureDays(db, [DAY]), { written: [DAY], already: [] });

  const [o] = await db.select({ n: count(), subtotal: sum(orders.subtotalCents) }).from(orders).where(eq(orders.day, DAY));
  assert.equal(o!.n, sim.orders.length);
  assert.equal(Number(o!.subtotal), sim.orders.reduce((s, x) => s + x.subtotalCents, 0));

  // qty × price over every line: what the lines say the orders cost
  const [l] = await db
    .select({ cents: sum(sql<number>`${orderLines.qty} * ${orderLines.priceCents}`) })
    .from(orderLines)
    .innerJoin(orders, eq(orders.id, orderLines.orderId))
    .where(eq(orders.day, DAY));
  assert.equal(Number(l!.cents), Number(o!.subtotal), "lines add up to the orders' subtotals");
});

test("writing the same day again does nothing", async () => {
  assert.equal(await writeSimDay(db, sim), "already");
  assert.deepEqual(await ensureDays(db, [DAY]), { written: [], already: [DAY] });
  assert.equal(await countOrders(db, DAY, new Date("2100-01-01")), sim.orders.length);
});

test("a day left half-written is cleared and written again, the same day", async () => {
  const ids = await publicIds();
  // A crash after the orders went in but before the marker: no sim_days row, and only some orders.
  await db.delete(simDays).where(eq(simDays.day, DAY));
  await db.delete(orders).where(sql`${orders.day} = ${DAY} and ${orders.ticket} > '0100'`);
  assert.ok((await countOrders(db, DAY, new Date("2100-01-01"))) < sim.orders.length);

  assert.equal(await writeSimDay(db, sim), "written");
  assert.deepEqual(await publicIds(), ids, "same orders, same public ids");
});

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

test("the menu is seeded in board order", async () => {
  const menu = await listMenu(db);
  assert.equal(menu[0]!.id, "espresso");
  assert.equal(menu.find((m) => m.id === "sixty-eight")!.priceCents, 625);
});

test("the daily job covers today and tomorrow in Austin; a backfill adds the days before", () => {
  const lateEvening = new Date("2026-11-15T03:30:00Z"); // 9:30 pm on the 14th in Austin
  assert.deepEqual(daysAhead(lateEvening), ["2026-11-14", "2026-11-15"]);
  assert.deepEqual(backfillDays(3, lateEvening), ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
});
