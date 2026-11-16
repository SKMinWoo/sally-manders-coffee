// The regression baselines: every page, whole, on a desktop and a phone, against the picture
// committed beside this file. They run on the stopped-clock server (playwright.config.ts), so the
// simulated day, the ticket numbers and the waits are the same on every run, and with motion
// reduced, so the intro and the rail hold still. One pixel off its picture (past Playwright's small
// colour tolerance) fails the page, and the report shows the old, the new and the difference.
//
// When a change is meant, CI's run fails and uploads what it saw: `gh run download <run id> -n
// browser-tests` gives test-results/, where each changed page has its -actual.png. Look at each, and
// copy the ones that are right over their baselines in visual.spec.ts-snapshots/.

import { expect, test } from "./fixtures";

test.use({ baseURL: "http://127.0.0.1:3101", contextOptions: { reducedMotion: "reduce" } });

/** Every page a visitor can reach, and the name its picture is kept under. An order's own page is
 * left out: its countdown is the browser's clock, not the server's. */
const PAGES = [
  ["storefront", "/"],
  ["order", "/order"],
  ["behind", "/behind"],
  ["docs", "/docs"],
  ["office", "/office"],
  ["twelve-factor", "/office/twelve-factor"],
] as const;

for (const [name, path] of PAGES) {
  test(`${name} looks the way it did`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled" });
  });
}
