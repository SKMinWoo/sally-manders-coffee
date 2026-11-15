import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, hoursOf, isShopDate, shopClock, shopToday, weekdayOf } from "./time";

test("an ordinary day has 24 hours, starting at Austin midnight", () => {
  const h = hoursOf("2026-11-14");
  assert.equal(h.length, 24);
  assert.deepEqual(h.map((x) => x.hour), [...Array(24).keys()]);
  assert.equal(h[0]!.start.toISOString(), "2026-11-14T06:00:00.000Z"); // CST is UTC-6
});

test("the night the clocks go back has 25 hours, with 1 am twice", () => {
  const h = hoursOf("2026-11-01");
  assert.equal(h.length, 25);
  assert.deepEqual(h.slice(0, 4).map((x) => x.hour), [0, 1, 1, 2]);
  assert.equal(h[0]!.start.toISOString(), "2026-11-01T05:00:00.000Z"); // still CDT, UTC-5
});

test("the night the clocks go forward has 23 hours, and no 2 am", () => {
  const h = hoursOf("2027-03-14");
  assert.equal(h.length, 23);
  assert.ok(!h.some((x) => x.hour === 2));
});

test("Austin's date is not UTC's date in the evening", () => {
  const nineAtNight = new Date("2026-11-15T03:00:00Z"); // 9 pm on the 14th in Austin
  assert.deepEqual(shopClock(nineAtNight), { date: "2026-11-14", hour: 21, minute: 0 });
  assert.equal(shopToday(nineAtNight), "2026-11-14");
});

test("calendar helpers", () => {
  assert.equal(addDays("2026-11-14", 1), "2026-11-15");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2026-11-01", 7), "2026-11-08");
  assert.equal(weekdayOf("2026-11-14"), 6); // a Saturday
  assert.ok(isShopDate("2026-11-14"));
  assert.ok(!isShopDate("2026-02-30"));
  assert.ok(!isShopDate("today"));
});
