// The storefront, the switch between the two views, and every page on a phone.

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

test("“Order ahead” opens the order page, from the headline, the first plate and the rail", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("link", { name: "Order ahead" });
  await expect(links).toHaveCount(3);
  for (const a of await links.all()) await expect(a).toHaveAttribute("href", "/order");
  await links.last().click();
  await expect(page).toHaveURL(/\/order$/);
  await expect(page.getByRole("heading", { name: "Pick from the board" })).toBeVisible();
});

test("the model: three tags out front, thirteen pins behind, and each pin's card links to its proof", async ({ page }) => {
  await page.goto("/");
  const model = page.getByRole("region", { name: "The model" });
  await expect(model.locator("button[data-key]")).toHaveCount(3);

  await model.getByRole("button", { name: "What runs it" }).click();
  await expect(model.locator("button[data-key]")).toHaveCount(13);
  await model.locator('button[data-key="desk"]').click();
  // the camera glides onto the desk, and once it lands the lens refocuses: its close-up fades in
  await expect(model.locator("[data-zoom]")).toHaveCount(1);
  await expect(model.locator("img[data-on]")).toHaveCount(1);
  await expect(model.getByRole("link", { name: "The proof" })).toHaveAttribute("href", "/office#ai-adoption");
  await page.keyboard.press("Escape");
  await expect(model.getByRole("link", { name: "The proof" })).toHaveCount(0);
  await expect(model.locator("[data-zoom]")).toHaveCount(0); // and back out to the whole model

  // the clock runs here, so the caption counts the quarter hour (visual.spec.ts covers it stopped)
  await expect(model).toContainText(/\d+ orders? in the last 15 min/);
});

test("the switch moves between the storefront and behind the scenes, and says where you are", async ({ page }) => {
  await page.goto("/");
  const view = page.getByRole("navigation", { name: "View" });
  await expect(view.getByRole("link", { name: "Storefront" })).toHaveAttribute("aria-current", "page");

  await view.getByRole("link", { name: "Behind the scenes" }).click();
  await expect(page).toHaveURL(/\/behind$/);
  await expect(page.getByRole("heading", { name: "The rail, so far" })).toBeVisible();
  await expect(view.getByRole("link", { name: "Behind the scenes" })).toHaveAttribute("aria-current", "page");
  await expect(view.getByRole("link", { name: "Storefront" })).not.toHaveAttribute("aria-current", /./);

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
