// The shop's home page, the header's three parts, and every page on a phone.

import { taxCents } from "@/lib/money";
import { cents, expect, expectNoSidewaysScroll, test } from "./fixtures";

const PAGES = ["/", "/order", "/behind", "/docs", "/office", "/office/twelve-factor"];

test("the board shows the whole menu, in its four sections, with prices", async ({ page }) => {
  await page.goto("/");
  const board = page.locator("#board");
  await expect(board.getByRole("heading", { level: 3 })).toHaveText(["Espresso bar", "Brewed", "Not coffee", "From the warmer"]);
  await expect(board.getByRole("listitem")).toHaveCount(13);
  for (const price of await board.getByRole("listitem").locator("span").filter({ hasText: /^\$?\d+\.\d\d$/ }).allInnerTexts()) {
    expect(cents(price)).toBeGreaterThan(0);
  }
  await expect(board).toContainText("iced hibiscus espresso, cold as the springs");
});

test("the example check on the storefront adds up", async ({ page }) => {
  await page.goto("/");
  const check = page.locator("section", { has: page.locator("#rail-title") }).locator("dl");
  const lines = check.locator("> div");
  const amount = async (i: number) => cents(await lines.nth(i).locator("dd").innerText());
  const subtotal = (await amount(0)) + (await amount(1));
  expect(await amount(2), "tax").toBe(taxCents(subtotal));
  expect(await amount(3), "total").toBe(subtotal + taxCents(subtotal));
});

test("“Order ahead” opens the order page, from the first act and the check", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("link", { name: "Order ahead" });
  await expect(links).toHaveCount(2);
  for (const a of await links.all()) await expect(a).toHaveAttribute("href", "/order");
  await links.last().click();
  await expect(page).toHaveURL(/\/order$/);
  await expect(page.getByRole("heading", { name: "Pick from the board" })).toBeVisible();
});

test("the model: no beads in the first two acts, thirteen in the third, and each one's card links to its proof", async ({ page, isMobile }) => {
  await page.goto("/");
  const model = page.getByRole("region", { name: "The model" });
  await expect(model.locator("button[data-key]")).toHaveCount(0);

  // wide, the tab brings the act; on a phone the acts are sections under the stuck model
  if (isMobile) await page.locator('[data-act="2"]').scrollIntoViewIfNeeded();
  else await page.getByRole("navigation", { name: "The shop in three parts" }).getByRole("button", { name: /How it’s built/ }).click();
  await expect(model.locator("button[data-key]")).toHaveCount(13);
  // a first visit lifts the roof (a beat, then 1.6s), and the beads take no pointer until it's off
  await expect(model.locator('[data-roof="off"]')).toHaveCount(1);

  // a part's line in the list and its bead light together
  const line = model.locator('[data-act="2"] button', { hasText: "Brief" });
  await line.hover();
  await expect(model.locator('button[data-key="desk"]')).toHaveAttribute("data-hot", "");

  // tapped where it stands, as a person would: Playwright's own scroll-into-view would take the stuck
  // model back to its place in the page, and the page back to the first act, before clicking
  const bead = (await model.locator('button[data-key="desk"]').boundingBox())!;
  const [x, y] = [bead.x + bead.width / 2, bead.y + bead.height / 2];
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(model.getByRole("link", { name: "The proof" })).toHaveAttribute("href", "/office#ai-adoption");
  await expect(model.getByRole("dialog")).toBeVisible();
  if (!isMobile) {
    // wide, the card takes the act's place above the model, so it never covers the set
    const [cardBottom, setTop] = await page.evaluate(() => [
      document.querySelector('[role="dialog"]')!.getBoundingClientRect().bottom,
      document.querySelector("#sally-model img")!.getBoundingClientRect().top,
    ]);
    expect(cardBottom).toBeLessThanOrEqual(setTop);
  }
  await page.keyboard.press("Escape");
  await expect(model.getByRole("link", { name: "The proof" })).toHaveCount(0);

  // the clock runs here, so the caption counts the quarter hour (visual.spec.ts covers it stopped)
  await expect(model).toContainText(/\d+ orders? in the last 15 min/);
});

test("the header names the three parts, says which one you're in, and leads back to the résumé", async ({ page }) => {
  await page.goto("/");
  const parts = page.getByRole("navigation", { name: "Sections" });
  await expect(parts.getByRole("link")).toHaveCount(3);
  await expect(parts.getByRole("link", { name: /The shop/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: /Back to the résumé/ })).toHaveAttribute("href", /^https:\/\/.+\.vercel\.app/);

  await parts.getByRole("link", { name: /The numbers/ }).click();
  await expect(page).toHaveURL(/\/behind$/);
  await expect(parts.getByRole("link", { name: /The numbers/ })).toHaveAttribute("aria-current", "page");
  await expect(parts.getByRole("link", { name: /The shop/ })).not.toHaveAttribute("aria-current", /./);

  await parts.getByRole("link", { name: /How it’s built/ }).click();
  await expect(page).toHaveURL(/\/office$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("How it’s built");
  await expect(parts.getByRole("link", { name: /How it’s built/ })).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Sally Mander’s" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("every page is sent with its security headers", async ({ page }) => {
  for (const path of PAGES) {
    const res = await page.goto(path);
    const h = res!.headers();
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

for (const path of PAGES) {
  test(`${path} fits the screen and has a title`, async ({ page }) => {
    await page.goto(path);
    await expectNoSidewaysScroll(page);
    await expect(page).toHaveTitle(/Sally Mander/);
  });
}
