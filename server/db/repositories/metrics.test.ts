import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { taxCents } from "@/lib/money";
import type { Db } from "../client";
import { testDb } from "../test-db";
import { simulateDay } from "@/server/sim/day";
import { ensureDays } from "@/server/sim/run";
import { daySummary, itemsSold, ordersByHour } from "./metrics";

let db: Db, close: () => Promise<void>;
before(async () => {
  ({ db, close } = await testDb());
  await ensureDays(db, [DAY]);
});
after(() => close());

const DAY = "2026-11-13";
const sim = simulateDay(DAY);
const END = new Date("2100-01-01");
const NOON = new Date("2026-11-13T18:00:00Z"); // noon in Austin (CST)

test("the day's summary matches the simulated day, cent for cent", async () => {
  const s = await daySummary(db, DAY, END);
  assert.equal(s.orders, sim.orders.length);
  assert.equal(s.visitorOrders, 0);
  assert.equal(s.salesCents, sim.orders.reduce((n, o) => n + o.subtotalCents, 0));
  assert.equal(s.taxCents, sim.orders.reduce((n, o) => n + taxCents(o.subtotalCents), 0));
  assert.ok(s.waitP50! > 0 && s.waitP95! >= s.waitP50!, "waits are positive and the tail is slower");
});

test("the percentiles are Postgres's percentile_cont over ready minus placed", async () => {
  const waits = sim.orders.map((o) => (+o.readyAt - +o.placedAt) / 1000).sort((a, b) => a - b);
  const cont = (p: number) => {
    const i = p * (waits.length - 1);
    const lo = Math.floor(i);
    return waits[lo]! + (waits[Math.ceil(i)]! - waits[lo]!) * (i - lo);
  };
  const s = await daySummary(db, DAY, END);
  assert.equal(s.waitP50, cont(0.5));
  assert.ok(Math.abs(s.waitP95! - cont(0.95)) < 1e-9);
});

test("so far means so far: nothing placed after the instant counts", async () => {
  const sofar = sim.orders.filter((o) => o.placedAt <= NOON);
  const s = await daySummary(db, DAY, NOON);
  assert.equal(s.orders, sofar.length);
  assert.equal(s.salesCents, sofar.reduce((n, o) => n + o.subtotalCents, 0));

  const hours = await ordersByHour(db, DAY, NOON);
  assert.ok(hours.every((h) => h.hour <= 12));
  assert.equal(hours.reduce((n, h) => n + h.orders, 0), sofar.length);

  const items = await itemsSold(db, DAY, NOON);
  const qty = sofar.flatMap((o) => o.lines).reduce((n, l) => n + l.qty, 0);
  assert.equal(items.reduce((n, i) => n + i.qty, 0), qty);
});

test("an empty day reads as zeros, not as an error", async () => {
  const s = await daySummary(db, "2026-11-20", END);
  assert.deepEqual(s, { orders: 0, visitorOrders: 0, salesCents: 0, taxCents: 0, waitP50: null, waitP95: null });
  assert.deepEqual(await ordersByHour(db, "2026-11-20", END), []);
});

test("hours are Austin hours, and items sort by quantity", async () => {
  const hours = await ordersByHour(db, DAY, END);
  // overnight runs about 2 orders an hour, so an hour can be empty; what must hold is Austin's clock
  const austinHour = (d: Date) => Number(d.toLocaleString("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" }));
  const expected = new Map<number, number>();
  for (const o of sim.orders) expected.set(austinHour(o.placedAt), (expected.get(austinHour(o.placedAt)) ?? 0) + 1);
  assert.deepEqual(hours.map((h) => [h.hour, h.orders]), [...expected].sort((a, b) => a[0] - b[0]));
  const items = await itemsSold(db, DAY, END);
  for (let i = 1; i < items.length; i++) assert.ok(items[i - 1]!.qty >= items[i]!.qty);
  assert.equal(items.reduce((n, i) => n + i.salesCents, 0), sim.orders.reduce((n, o) => n + o.subtotalCents, 0));
});
