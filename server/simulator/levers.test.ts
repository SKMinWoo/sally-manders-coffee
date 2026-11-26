import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { addDays, shopClock } from "@/lib/time";
import { BASE_STAFF_HOURS, LEVER_IDS, LEVERS, simulateDay, staffHours, type LeverId, type SimDay } from "@/server/simulator";

const WEEK = Array.from({ length: 7 }, (_, i) => addDays("2026-11-09", i));
const wait = (o: SimDay["orders"][number]) => (+o.readyAt - +o.placedAt) / 1000;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const hour = (o: SimDay["orders"][number]) => shopClock(o.placedAt).hour;

/** A week with the lever and the same week without it, both drawn the lever way (v2 streams). */
function pair(lever: LeverId, inHours = true) {
  const on = WEEK.flatMap((d) => simulateDay(d, [lever]).orders);
  const off = WEEK.flatMap((d) => simulateDay(d, []).orders);
  const h = LEVERS[lever].hours;
  const keep = (o: SimDay["orders"][number]) => !inHours || h === null || (hour(o) >= h[0] && hour(o) < h[1]);
  return { on: on.filter(keep), off: off.filter(keep) };
}

test("a day without levers is byte for byte the day it was before the levers existed", () => {
  // first pinned before levers were added (60 of 60 days from 2026-10-01 matched, the clock change
  // included), and pinned again when demand was reshaped (decision 0009): days already in the
  // database keep the shape they were written with, and this pins the one every new day gets
  const fingerprint = createHash("sha256").update(JSON.stringify(simulateDay("2026-11-13"))).digest("hex").slice(0, 16);
  assert.equal(fingerprint, "76c12bfaea967ebc");
});

test("with levers, each order draws from its own stream, so a change that doesn't move demand leaves the same guests", () => {
  const off = simulateDay("2026-11-13", []);
  const on = simulateDay("2026-11-13", ["prepAhead"]);
  assert.equal(on.orders.length, off.orders.length);
  on.orders.forEach((o, i) => {
    assert.equal(+o.placedAt, +off.orders[i]!.placedAt);
    assert.deepEqual(o.lines, off.orders[i]!.lines);
  });
  assert.deepEqual(simulateDay("2026-11-13", ["prepAhead", "pickupShelf"]).levers, ["pickupShelf", "prepAhead"], "stored sorted");
});

test("each lever moves its figure the way its card says", () => {
  for (const id of ["rushBarista", "prepAhead", "pickupShelf"] as const) {
    const { on, off } = pair(id);
    assert.ok(median(on.map(wait)) < median(off.map(wait)), `${id} shortens the wait in its hours`);
  }
  // the evenings rarely queue at one barista (about one guest every ten minutes against the bar's 16
  // an hour), so the second barista helps a little now and then, nowhere near the 10% its two hours
  // must find under the board's rule (decision 0009): the measurement should take it back
  const evening = pair("eveningBarista");
  const eveningGain = 1 - median(evening.on.map(wait)) / median(evening.off.map(wait));
  assert.ok(eveningGain >= 0 && eveningGain < 0.1, `a second evening barista barely moves the wait (${(eveningGain * 100).toFixed(1)}%)`);
  const pastry = pair("pastryPairing");
  const items = (os: typeof pastry.on) => os.reduce((n, o) => n + o.lines.reduce((m, l) => m + l.qty, 0), 0);
  assert.ok(items(pastry.on) > items(pastry.off), "the pastry pairing makes morning orders bigger");
  assert.ok(median(pastry.on.map(wait)) >= median(pastry.off.map(wait)), "and bigger orders wait no less");
  const sign = pair("sidewalkSign");
  assert.ok(sign.on.length > sign.off.length, "the sign brings more people in, in its hours");
});

test("barista hours: the base rota, plus what each lever costs", () => {
  assert.equal(staffHours([]), BASE_STAFF_HOURS);
  assert.equal(staffHours(["rushBarista", "eveningBarista"]), BASE_STAFF_HOURS + 5);
  for (const id of LEVER_IDS) assert.ok(LEVERS[id].staffHours >= 0 && LEVERS[id].cost.length > 0, id);
});
