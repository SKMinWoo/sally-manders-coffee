// The browser tests (e2e/): a real browser against the production build, `next start`, on a
// fresh local Postgres (PGlite in .pglite-e2e/, seeded by the simulator as it starts). Every test
// runs twice, at a desktop width and on a phone. Run `npm run build` first; CI does.
//
// Locally they drive the installed Microsoft Edge (PW_CHANNEL picks another, "chrome" say), so
// nothing has to be downloaded. CI installs Playwright's own Chromium.

import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const CI = !!process.env.CI;
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
        ["html", { open: "never" }],
      ]
    : [["list"], ["./scripts/ci/barcode-facts.mjs", { outputFile: ".ci/barcodes.json" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    screenshot: "only-on-failure",
    trace: CI ? "retain-on-failure" : "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel } },
    { name: "phone", use: { ...devices["Pixel 7"], channel } },
  ],
  webServer: {
    // a fresh database every run, so no test depends on what an earlier run left behind
    command: `node -e "require('fs').rmSync('.pglite-e2e',{recursive:true,force:true})" && npx next start -p ${PORT}`,
    // health answers once the simulator has written today and tomorrow
    url: `http://127.0.0.1:${PORT}/api/v1/health`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: { LOCAL_DB: ".pglite-e2e", IP_HASH_SALT: "browser-tests-only", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
