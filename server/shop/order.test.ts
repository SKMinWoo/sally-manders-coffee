import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { PUBLIC_ID } from "@/lib/ids";
import type { Db } from "@/server/db/client";
import { findOrder } from "@/server/db/repositories/orders";
import { orders } from "@/server/db/schema";
import { testDb } from "@/server/db/test-db";
import { ensureDays } from "@/server/sim/run";
import { LIMITS, placeVisitorOrder, visitorTicket } from "./order";

let db: Db, close: () => Promise<void>;
before(async () => {
  ({ db, close } = await testDb());
  await ensureDays(db, ["2026-11-13"]); // a busy simulated day underneath, tickets 0001 and up
});
after(() => close());

const NOON = new Date("2026-11-13T18:00:00Z"); // noon in Austin
const at = (minutes: number) => new Date(+NOON + minutes * 60_000);
const order = (lines: unknown) => ({ lines });
let visitor = 0;
const fresh = () => `visitor-${++visitor}`; // a different visitor each time, unless a test reuses one

test("a good order goes on the rail, priced from the menu, with a visitor ticket and a real wait", async () => {
  const r = await placeVisitorOrder(db, order([{ itemId: "sixty-eight", qty: 1 }, { itemId: "kolache", qty: 1 }]), { visitorHash: fresh(), now: NOON });
  assert.ok(r.ok);
  assert.match(r.publicId, PUBLIC_ID);
  assert.equal(r.ticket, "A-01");

  const o = (await findOrder(db, r.publicId, NOON))!;
  assert.equal(o.source, "visitor");
  assert.equal(o.subtotalCents, 1025);
  assert.equal(o.taxCents, 85, "the mockup's check: $10.25 + $0.85");
  assert.deepEqual(o.lines.map((l) => [l.itemId, l.qty, l.priceCents]), [["sixty-eight", 1, 625], ["kolache", 1, 400]]);
  const wait = (+o.readyAt - +o.placedAt) / 1000;
  assert.ok(wait >= 80 && wait < 900, `a believable wait, got ${wait}s`);
});

test("the browser can't set a price, a name, or anything else", async () => {
  const cases: [string, unknown][] = [
    ["a price", order([{ itemId: "latte", qty: 1, priceCents: 1 }])],
    ["an extra field", { lines: [{ itemId: "latte", qty: 1 }], total: 1 }],
    ["a sixth latte", order([{ itemId: "latte", qty: 6 }])],
    ["half a latte", order([{ itemId: "latte", qty: 0.5 }])],
    ["no lattes", order([{ itemId: "latte", qty: 0 }])],
    ["an empty check", order([])],
    ["eleven lines", order(Array.from({ length: 11 }, (_, i) => ({ itemId: `item-${i}`, qty: 1 })))],
    ["the same item twice", order([{ itemId: "latte", qty: 1 }, { itemId: "latte", qty: 2 }])],
    ["not an object", "latte please"],
  ];
  for (const [what, input] of cases) {
    const r = await placeVisitorOrder(db, input, { visitorHash: fresh(), now: NOON });
    assert.ok(!r.ok && r.reason === "invalid", `rejects ${what}`);
  }
  const unknown = await placeVisitorOrder(db, order([{ itemId: "flat-white", qty: 1 }]), { visitorHash: fresh(), now: NOON });
  assert.ok(!unknown.ok && unknown.reason === "unknown-item");
});

test("one visitor can place five orders in ten minutes; the sixth is turned away, and ten minutes later it isn't", async () => {
  const me = fresh();
  const latte = order([{ itemId: "latte", qty: 1 }]);
  for (let i = 0; i < LIMITS.perVisitor; i++) assert.ok((await placeVisitorOrder(db, latte, { visitorHash: me, now: at(i) })).ok);
  const sixth = await placeVisitorOrder(db, latte, { visitorHash: me, now: at(5) });
  assert.ok(!sixth.ok && sixth.reason === "slow-down");
  assert.ok((await placeVisitorOrder(db, latte, { visitorHash: fresh(), now: at(5) })).ok, "someone else still can");
  assert.ok((await placeVisitorOrder(db, latte, { visitorHash: me, now: at(10.5) })).ok, "the window moves on");
});

test("visitor tickets count up in their own series and never collide with the simulator's", async () => {
  const day = await db.select({ ticket: orders.ticket, source: orders.source }).from(orders).where(eq(orders.day, "2026-11-13"));
  const visitor = day.filter((o) => o.source === "visitor").map((o) => o.ticket).sort();
  assert.deepEqual(visitor, Array.from({ length: visitor.length }, (_, i) => visitorTicket(i + 1)));
  assert.equal(new Set(day.map((o) => o.ticket)).size, day.length, "every ticket on the day is unique");
  assert.equal(visitorTicket(7), "A-07");
  assert.equal(visitorTicket(123), "A-123");
});

test("two visitors at the same instant both get on the rail, with different tickets", async () => {
  const latte = order([{ itemId: "latte", qty: 1 }]);
  const [a, b] = await Promise.all([
    placeVisitorOrder(db, latte, { visitorHash: fresh(), now: at(20) }),
    placeVisitorOrder(db, latte, { visitorHash: fresh(), now: at(20) }),
  ]);
  assert.ok(a.ok && b.ok);
  assert.notEqual(a.ticket, b.ticket);
});

test("when the day's rail is full, nobody else gets on it", async () => {
  const full = { ...LIMITS, perDay: 3 }; // the day already has more than 3 visitor orders from the tests above
  const r = await placeVisitorOrder(db, order([{ itemId: "drip", qty: 1 }]), { visitorHash: fresh(), now: at(30), limits: full });
  assert.ok(!r.ok && r.reason === "rail-full");
});
