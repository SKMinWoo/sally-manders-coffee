// The back office and the twelve factors: what the page says agrees with itself and with the API.

import { expect, test } from "./fixtures";

type Claim = { status: string; figures: unknown[]; chart: unknown };

test("one card per résumé line, and the band counts what the cards say", async ({ page, request }) => {
  const report = await (await request.get("/api/v1/engineering")).json();
  const running = report.claims.filter((c: Claim) => c.status === "running").length;
  const pending = report.claims.filter((c: Claim) => c.status === "running" && c.figures.length === 0 && !c.chart).length;
  await page.goto("/office");
  // measured, then the ones waiting on a first run, so the band never says more than the cards
  const band = `The back office · ${running - pending} of ${report.claims.length} measured`;
  await expect(page.getByText(pending ? `${band} · ${pending} first run pending` : band)).toBeVisible();
  const cards = page.locator('section[aria-labelledby^="role-"] > ul > li');
  await expect(cards).toHaveCount(report.claims.length);
  // numbered in reading order; a running card whose first run hasn't posted says so instead
  await expect(cards.filter({ hasText: /^No\. \d\d(Running|First run pending)/ })).toHaveCount(running);
  await expect(cards.first()).toContainText(/^No\. 01/);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([/At a glance/, /Full-stack/, /Test engineer/]);
});

test("at a glance: a line per claim, each one taking you to its card", async ({ page, request }) => {
  const report = await (await request.get("/api/v1/engineering")).json();
  await page.goto("/office");
  const lines = page.getByRole("region", { name: "At a glance" }).getByRole("link");
  await expect(lines).toHaveCount(report.claims.length);
  const last = lines.last();
  const id = (await last.getAttribute("href"))!.slice(1);
  await last.click();
  await expect(page.locator(`[id="${id}"]`)).toBeInViewport();
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
  await expect(page.getByText(`The twelve factors · ${12 - gaps} met, ${gaps} with a gap`)).toBeVisible();
  await page.getByRole("link", { name: /back office/i }).first().click();
  await expect(page).toHaveURL(/\/office$/);
});
