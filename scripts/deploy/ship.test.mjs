import { test } from "node:test";
import assert from "node:assert/strict";
import { probeStats, smokeProblem, SMOKE } from "./ship.mjs";

const at = (...oks) => oks.map((ok, i) => ({ at: 1000 + i * 1000, ok }));

test("the probe: a clean switch fails nothing and never waits more than a second", () => {
  assert.deepEqual(probeStats(at(true, true, true, true)), { requests: 4, failed: 0, longestGapMs: 1000 });
});

test("the probe: failed requests are counted, and the wait runs from one good answer to the next", () => {
  assert.deepEqual(probeStats(at(true, false, false, true, true)), { requests: 5, failed: 2, longestGapMs: 3000 });
  // failing at the start or the end is a wait too, not a free pass
  assert.equal(probeStats(at(false, false, true)).longestGapMs, 2000);
  assert.equal(probeStats(at(true, false, false)).longestGapMs, 2000);
  assert.deepEqual(probeStats([]), { requests: 0, failed: 0, longestGapMs: 0 });
});

test("the smoke test: a page must be the shop's, an endpoint must answer JSON, and both 200", () => {
  const page = { html: true }, api = { html: false };
  assert.equal(smokeProblem(page, 200, "text/html; charset=utf-8", "<title>Sally Mander&#x27;s</title>"), null);
  assert.equal(smokeProblem(page, 200, "text/html", "<title>Vercel</title>"), "is not the shop's page");
  assert.equal(smokeProblem(page, 307, "text/html", ""), "answered 307");
  assert.equal(smokeProblem(api, 200, "application/json", '{"status":"ok"}'), null);
  assert.equal(smokeProblem(api, 200, "text/html", "<html>"), "is not JSON");
  assert.equal(smokeProblem(api, 500, "application/json", "{}"), "answered 500");
});

test("the smoke test covers every page and the API's read endpoints", () => {
  assert.deepEqual(SMOKE.filter((c) => c.html).map((c) => c.path), ["/", "/order", "/behind", "/office", "/docs"]);
  assert.ok(SMOKE.some((c) => c.path === "/api/v1/openapi.json"));
});
