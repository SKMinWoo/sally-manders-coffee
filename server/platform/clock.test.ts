import { test } from "node:test";
import assert from "node:assert/strict";
import { now, stoppedAt } from "./clock";

test("the clock runs, unless SHOP_FROZEN_AT stops it, and never stops on Vercel", () => {
  const before = Date.now();
  assert.ok(+now({}) >= before, "running by default");
  assert.equal(now({ SHOP_FROZEN_AT: "2026-11-13T19:30:00Z" }).toISOString(), "2026-11-13T19:30:00.000Z");
  assert.ok(+now({ SHOP_FROZEN_AT: "2026-11-13T19:30:00Z", VERCEL: "1" }) >= before, "production keeps real time");
  assert.throws(() => now({ SHOP_FROZEN_AT: "teatime" }), /not a time/);
  assert.equal(stoppedAt({}), "");
  assert.equal(stoppedAt({ SHOP_FROZEN_AT: "2026-11-13T19:30:00Z", VERCEL: "1" }), "");
});
