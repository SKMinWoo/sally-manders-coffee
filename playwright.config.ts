// The browser tests (e2e/): a real browser against the production build, `next start`, on a
// fresh local Postgres (PGlite in .pglite-e2e/, seeded by the simulator as it starts). Every test
// runs twice, at a desktop width and on a phone. Run `npm run build` first; CI does.
//
// Locally they drive the installed Microsoft Edge (PW_CHANNEL picks another, "chrome" say), so
// nothing has to be downloaded. CI installs Playwright's own Chromium.
//
// The screenshot baselines (e2e/visual.spec.ts) get a second server on the same build, with its
// clock stopped (server/platform/clock.ts) and its own database, so every run renders the same
// shop. Baselines are drawn per platform; the committed ones are CI's (Linux), so on a laptop they
// are skipped unless PW_VISUAL=1, which compares against (and first draws) a local set.

import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
/** the stopped-clock server for the baselines; e2e/visual.spec.ts points here */
const VISUAL_PORT = 3101;
/** a Friday, half past one in Austin: the shop's afternoon, frozen */
const STOPPED_AT = "2026-11-13T19:30:00Z";
const CI = !!process.env.CI;
const fresh = (dir: string) => `node -e "require('fs').rmSync('${dir}',{recursive:true,force:true})"`;
const channel = CI ? undefined : (process.env.PW_CHANNEL ?? "msedge");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: CI,
  // One retry in CI, and a test that only passes on it is counted as flaky, not as passing.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI
    ? [
        ["list"],
        ["./scripts/ci/ui-test-facts.mjs", { outputFile: ".ci/ui-tests.json" }],
        ["./scripts/ci/barcode-facts.mjs", { outputFile: ".ci/barcodes.json" }],
        ["./scripts/ci/baseline-facts.mjs", { outputFile: ".ci/baselines.json" }],
        ["html", { open: "never" }],
      ]
    : [["list"], ["./scripts/ci/barcode-facts.mjs", { outputFile: ".ci/barcodes.json" }]],
  // CI never draws a missing baseline: it fails, and the picture it took is in the uploaded report
  updateSnapshots: CI ? "none" : "missing",
  ignoreSnapshots: !CI && !process.env.PW_VISUAL,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "only-on-failure",
    trace: CI ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "phone", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: [
    {
      // a fresh database every run, so no test depends on what an earlier run left behind
      command: `${fresh(".pglite-e2e")} && npx next start -p ${PORT}`,
      // health answers once the simulator has written today and tomorrow
      url: `http://127.0.0.1:${PORT}/api/v1/health`,
      reuseExistingServer: !CI,
      timeout: 180_000,
      env: { LOCAL_DB: ".pglite-e2e", IP_HASH_SALT: "browser-tests-only", NEXT_TELEMETRY_DISABLED: "1" },
    },
    {
      command: `${fresh(".pglite-visual")} && npx next start -p ${VISUAL_PORT}`,
      url: `http://127.0.0.1:${VISUAL_PORT}/api/v1/health`,
      reuseExistingServer: !CI,
      timeout: 180_000,
      env: { LOCAL_DB: ".pglite-visual", SHOP_FROZEN_AT: STOPPED_AT, IP_HASH_SALT: "browser-tests-only", NEXT_TELEMETRY_DISABLED: "1" },
    },
  ],
});
