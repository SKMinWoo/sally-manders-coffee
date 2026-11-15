// Behind the scenes: today's figures, and the sales export as a visitor uses it.

import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

test("today's figures are pinned up, each against last week", async ({ page }) => {
  await page.goto("/behind");
  await expect(page.getByText(/^Behind the scenes · \w{3} \d+ \w{3} · as of \d/)).toBeVisible();
  const pinned = page.locator("main ul").first().getByRole("listitem");
  await expect(pinned).not.toHaveCount(0);
  for (const card of await pinned.all()) await expect(card.locator("p")).toHaveCount(3); // label, figure, versus
  await expect(page.getByRole("heading", { name: "When they came" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What they had" })).toBeVisible();
  await expect(page.getByText(/placed by\s+visitors on this site and [\d,]+ by the simulator/)).toBeVisible();
});

test("“Export sales” downloads a workbook of the last four weeks", async ({ page }) => {
  await page.goto("/behind");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export .xlsx" }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/^sally-manders-sales-\d{4}-\d\d-\d\d-to-\d{4}-\d\d-\d\d\.xlsx$/);
  const bytes = await readFile(await file.path());
  expect(bytes.subarray(0, 2).toString(), "an .xlsx is a zip").toBe("PK");
  await expect(page.getByRole("status")).toHaveText(/^Downloading [\d,]+ order lines\.$/);
});

test.describe("an export longer than 92 days", () => {
  test.use({ allowedErrors: [/status of 400 .*\/api\/v1\/exports\/sales/] });
  // the page asks with HEAD, then GET for the wording; the browser logs both 400s
  test("is refused, with the reason", async ({ page }) => {
    await page.goto("/behind");
    const to = await page.getByLabel("To").inputValue();
    const from = new Date(Date.parse(`${to}T12:00:00Z`) - 120 * 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("From").fill(from);
    await page.getByRole("button", { name: "Export .xlsx" }).click();
    await expect(page.getByRole("status")).toHaveText("121 days asked for; at most 92 in one workbook");
  });
});

test("the back office is a link away", async ({ page }) => {
  await page.goto("/behind");
  await page.getByRole("main").getByRole("link", { name: "the back office" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The back office");
});
