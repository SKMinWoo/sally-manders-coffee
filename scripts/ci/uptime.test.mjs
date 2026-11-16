import { test } from "node:test";
import assert from "node:assert/strict";
import { PROBE_TITLE, uptimeFrom } from "./uptime.mjs";

const NOW = new Date("2026-11-16T12:00:00Z");
const run = (hoursAgo, conclusion, display_title = PROBE_TITLE, status = "completed") => ({
  display_title,
  status,
  conclusion,
  created_at: new Date(NOW.getTime() - hoursAgo * 3_600_000).toISOString(),
});

test("uptime counts the finished probes of the last 30 days, and those that found the site down", () => {
  const runs = [run(1, "success"), run(2, "failure"), run(50, "success"), run(24 * 31, "failure")];
  assert.deepEqual(uptimeFrom(runs, NOW), { days: 3, probes: 3, failed: 1 }, "the 31-day-old failure is outside the window");
});

test("a dropped or cancelled probe is not an outage, and the daily report is not a probe", () => {
  const runs = [run(1, "success"), run(2, "cancelled"), run(3, null, PROBE_TITLE, "in_progress"), run(4, "failure", "Uptime report")];
  assert.deepEqual(uptimeFrom(runs, NOW), { days: 1, probes: 1, failed: 0 });
  assert.equal(uptimeFrom([], NOW), null, "no probes yet: no figure, not 100%");
});
