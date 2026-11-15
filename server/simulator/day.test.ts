import { test } from "node:test";
import assert from "node:assert/strict";
import { taxCents } from "@/lib/money";
import { hoursOf, shopClock } from "@/lib/time";
import { simulateDay, waitSeconds } from "./day";
import { MENU } from "@/server/menu";

const day = simulateDay("2026-11-13");

test("the same date always simulates to the same day", () => {
  assert.deepEqual(simulateDay("2026-11-13"), day);
  assert.notDeepEqual(simulateDay("2026-11-12").orders, day.orders);
});

test("a weekday is busy but believable", () => {
  assert.ok(day.orders.length > 200 && day.orders.length < 400, `${day.orders.length} orders`);
});

test("every order falls inside its Austin day, and tickets run in time order", () => {
  day.orders.forEach((o, i) => {
    assert.equal(shopClock(o.placedAt).date, day.date);
    assert.equal(o.ticket, String(i + 1).padStart(4, "0"));
    if (i > 0) assert.ok(o.placedAt >= day.orders[i - 1]!.placedAt);
  });
});

test("the money reconciles: lines make the subtotal, tax is on the subtotal, prices are the menu's", () => {
  const price = new Map(MENU.map((m) => [m.id, m.priceCents]));
  for (const o of day.orders) {
    assert.ok(o.lines.length > 0);
    assert.equal(o.subtotalCents, o.lines.reduce((s, l) => s + l.qty * l.priceCents, 0));
    assert.equal(o.taxCents, taxCents(o.subtotalCents));
    for (const l of o.lines) assert.equal(l.priceCents, price.get(l.itemId));
    assert.equal(new Set(o.lines.map((l) => l.itemId)).size, o.lines.length, "one line per item");
  }
});

test("waits are positive, and the slow tail is slower than the middle", () => {
  const waits = day.orders.map((o) => (o.readyAt.getTime() - o.placedAt.getTime()) / 1000).sort((a, b) => a - b);
  const q = (p: number) => waits[Math.floor(p * (waits.length - 1))]!;
  assert.ok(waits[0]! > 0);
  assert.ok(q(0.95) >= q(0.5));
  assert.ok(waitSeconds({ items: 1, load: 2, noise: 0 }) > waitSeconds({ items: 1, load: 0.3, noise: 0 }));
});

test("the shop never closes: every hour of the day sees orders, the rush most of all", () => {
  const byHour = new Map<number, number>();
  for (const o of day.orders) byHour.set(shopClock(o.placedAt).hour, (byHour.get(shopClock(o.placedAt).hour) ?? 0) + 1);
  const busiest = [...byHour].sort((a, b) => b[1] - a[1])[0]![0];
  assert.ok(busiest >= 7 && busiest <= 9, `busiest hour ${busiest}`);
  assert.ok(byHour.size >= 20, `orders in ${byHour.size} of 24 hours`);
});

test("the daylight-saving days simulate their real number of hours", () => {
  for (const date of ["2026-11-01", "2027-03-14"]) {
    const d = simulateDay(date);
    const first = hoursOf(date)[0]!.start, after = new Date(first.getTime() + hoursOf(date).length * 3_600_000);
    for (const o of d.orders) assert.ok(o.placedAt >= first && o.placedAt < after);
  }
});
