import assert from "node:assert/strict";
import { test } from "node:test";
import { busiestQuarter, QUIET, REPLAY_LEAD_MS, replayOf } from "./replay";

const MIN = 60_000;
const at = (m: number, wait = 3) => ({ placedAt: m * MIN, readyAt: (m + wait) * MIN });

test("the busiest quarter hour: the fifteen minutes with the most orders placed in them", () => {
  const day = [at(0), at(50), at(52), at(55), at(64), at(65), at(200)];
  const q = busiestQuarter(day)!;
  assert.equal(q.from, 50 * MIN);
  assert.deepEqual(q.orders.map((o) => o.placedAt / MIN), [50, 52, 55, 64]);
  assert.equal(busiestQuarter([]), null);
});

test("a quiet street gets a replay that began two minutes ago, each order's wait kept, and a busy one none", () => {
  const day = [at(480), at(482, 5), at(483), at(487), at(490), at(493), at(1300)];
  const now = 2000 * MIN;
  const r = replayOf(1, day, now)!;
  assert.equal(r.from, 480 * MIN);
  assert.equal(r.orders.length, 6);
  assert.equal(r.orders[0]!.placedAt, now - REPLAY_LEAD_MS);
  assert.equal(r.orders[1]!.readyAt - r.orders[1]!.placedAt, 5 * MIN);
  assert.ok(r.orders.every((o) => o.replay));
  assert.equal(r.until, Math.max(...r.orders.map((o) => o.readyAt)));

  assert.equal(replayOf(QUIET, day, now), null, "enough guests already: no replay");
  assert.equal(replayOf(0, [], now), null, "nothing stored: the street stays quiet, nobody is invented");
  assert.equal(replayOf(2, [at(0), at(1)], now), null, "a replay no busier than now isn't worth showing");
});
