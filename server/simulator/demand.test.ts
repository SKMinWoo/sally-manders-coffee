import { test } from "node:test";
import assert from "node:assert/strict";
import { demandAt } from "./demand";

// The day's shape, as the front page's model shows it: each order is a guest who walks in, so an hour
// with too few orders is an empty room on the model. These checks hold the curve to "busy in the
// morning, never empty"; the numbers in the last test are the round-2 ask (more guests, spread more
// evenly), which demandAt meets since decision 0009.

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const dayOf = (weekday: number) => HOURS.map((hour) => demandAt({ hour, weekday }));
const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("every hour of every day expects someone, and nothing is negative or not a number", () => {
  for (const weekday of WEEKDAYS) {
    for (const [hour, n] of dayOf(weekday).entries()) assert.ok(Number.isFinite(n) && n > 0, `${weekday}/${hour}: ${n}`);
  }
});

test("a weekday peaks in the morning rush, and a weekend later in the morning", () => {
  const peakHour = (xs: number[]) => xs.indexOf(Math.max(...xs));
  for (const weekday of [1, 2, 3, 4, 5]) assert.ok(peakHour(dayOf(weekday)) >= 7 && peakHour(dayOf(weekday)) <= 9);
  for (const weekday of [0, 6]) assert.ok(peakHour(dayOf(weekday)) >= 9 && peakHour(dayOf(weekday)) <= 11);
});

test("the day stays inside what the simulator's other checks expect (200 to 400 orders)", () => {
  for (const weekday of WEEKDAYS) {
    const n = total(dayOf(weekday));
    assert.ok(n > 200 && n < 400, `weekday ${weekday}: ${n.toFixed(0)}`);
  }
});

test(
  "steadier guests: a little more each day, the quietest hour at least one order every ten minutes, the rush no more than 6.5 times the lull",
  () => {
    for (const weekday of WEEKDAYS) {
      const day = dayOf(weekday);
      const quiet = Math.min(...day), busy = Math.max(...day);
      assert.ok(total(day) >= 320, `weekday ${weekday}: ${total(day).toFixed(0)} a day`);
      assert.ok(quiet >= 6, `weekday ${weekday}: quietest hour ${quiet.toFixed(1)}`);
      assert.ok(busy / quiet <= 6.5, `weekday ${weekday}: rush ${busy.toFixed(1)} against lull ${quiet.toFixed(1)}`);
    }
  },
);
