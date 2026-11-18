// The regression baselines: every page, whole, on a desktop and a phone, against the picture
// committed beside this file. They run on the stopped-clock server (playwright.config.ts), so the
// simulated day, the ticket numbers and the waits are the same on every run, and with motion
// reduced, so the intro and the rail hold still. One pixel off its picture (past Playwright's small
// colour tolerance) fails the page, and the report shows the old, the new and the difference.
//
// When a change is meant, CI's run fails and uploads what it saw: `gh run download <run id> -n
// browser-tests` gives test-results/, where each changed page has its -actual.png (a new page, with
// no baseline yet, gets one too). Look at each, and copy the ones that are right over their
// baselines in visual.spec.ts-snapshots/, named <page>-<project>-linux.png.

import { existsSync } from "node:fs";
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

test("with the clock stopped, nobody walks on the model, and the caption says why", async ({ page }) => {
  await page.goto("/");
  const model = page.getByRole("region", { name: "The model" });
  await expect(model).toContainText("The clock is stopped");
  await expect(model.locator("svg[aria-hidden] g")).toHaveCount(0);
});

for (const [name, path] of PAGES) {
  test(`${name} looks the way it did`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    // CI never draws a missing baseline, and Playwright then keeps only a viewport shot of the
    // failure, so keep the whole page here, for a person to look at before it's committed
    const info = test.info();
    if (info.config.updateSnapshots === "none" && !existsSync(info.snapshotPath(`${name}.png`, { kind: "screenshot" }))) {
      const shot = { fullPage: true, animations: "disabled", caret: "hide", scale: "css" } as const;
      await page.screenshot({ ...shot, path: info.outputPath(`${name}-actual.png`) });
    }
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true, animations: "disabled" });
  });
}
