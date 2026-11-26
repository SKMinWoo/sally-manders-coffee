// Résumé, running, and the twelve factors: what the page says agrees with itself and with the API.

import { expect, test } from "./fixtures";

test("one card per résumé line, and the band counts the running ones", async ({ page, request }) => {
  const report = await (await request.get("/api/v1/engineering")).json();
  const running = report.claims.filter((c: { status: string }) => c.status === "running").length;
  await page.goto("/office");
  await expect(page.getByText(`Résumé, running · ${running} of ${report.claims.length} running`)).toBeVisible();
  const cards = page.locator('section[aria-labelledby^="role-"] > ul > li');
  await expect(cards).toHaveCount(report.claims.length);
  await expect(cards.filter({ hasText: /^Exhibit \d\dRunning/ })).toHaveCount(running);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([/Full-stack/, /Test engineer/]);
});

test("its code links go to the repository, and its own pages open here", async ({ page }) => {
  await page.goto("/office");
  const hrefs = await page.locator('section[aria-labelledby^="role-"] > ul > li ul a').evaluateAll((as) => as.map((a) => a.getAttribute("href")!));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).toMatch(/^(https:\/\/github\.com\/SKMinWoo\/sally-manders-coffee\/|\/)/);

  await page.getByRole("link", { name: "The twelve factors" }).first().click();
  await expect(page).toHaveURL(/\/office\/twelve-factor$/);
});

test("the twelve factors are all there, and the band adds them up", async ({ page }) => {
  await page.goto("/office/twelve-factor");
  const factors = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) });
  await expect(factors).toHaveCount(12);
  const gaps = await factors.filter({ hasText: "Short of it" }).count();
  await expect(page.getByText(`Exhibit 05 · ${12 - gaps} met, ${gaps} with a gap`)).toBeVisible();
  await page.getByRole("main").getByRole("link", { name: "Résumé, running" }).click();
  await expect(page).toHaveURL(/\/office$/);
});
