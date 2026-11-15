// Ordering ahead, end to end: the board, the check, the server's checks on what it's sent, the
// order's page and its countdown. Every order here really goes into the database.

import type { Page } from "@playwright/test";
import { taxCents } from "@/lib/money";
import { cents, expect, test } from "./fixtures";

/** React has hydrated the board, so a tap reaches its handler instead of a dead button. */
async function openOrderPage(page: Page) {
  await page.goto("/order");
  await page.waitForFunction(() => {
    const b = document.querySelector("#board button");
    return !!b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
  });
}

const add = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^Add ${name},`) }).click();
const check = (page: Page) => page.locator("form dl");
const lineFor = (page: Page, dt: string | RegExp) => check(page).locator("> div").filter({ has: page.locator("dt", { hasText: dt }) });
const submit = (page: Page) => page.getByRole("button", { name: "Put it on the rail" });

/** Places an order of `items` and lands on its page. */
async function placeOrder(page: Page, items: string[]) {
  await openOrderPage(page);
  for (const name of items) await add(page, name);
  await submit(page).click();
  await page.waitForURL(/\/order\/[2-9a-z]{10}$/);
}

test("an empty check can't be sent", async ({ page }) => {
  await openOrderPage(page);
  await expect(check(page)).toContainText("Tap the board to add");
  await expect(submit(page)).toBeDisabled();
});

test("the check adds up as the board is tapped: lines, tax at 8.25% and the total", async ({ page }) => {
  await openOrderPage(page);
  await add(page, "Latte");
  await add(page, "Latte");
  await add(page, "Sausage kolache");

  await expect(lineFor(page, "2 Latte").locator("dd")).toHaveText("10.50");
  await expect(lineFor(page, "1 Sausage kolache").locator("dd")).toHaveText("4.00");
  await expect(page.getByRole("button", { name: /^Add Latte, \$5\.25, 2 on your check$/ })).toBeVisible();
  const subtotal = 1050 + 400;
  expect(cents(await lineFor(page, "Tax").locator("dd").innerText())).toBe(taxCents(subtotal));
  expect(cents(await lineFor(page, "Total").locator("dd").innerText())).toBe(subtotal + taxCents(subtotal));
  await expect(submit(page)).toBeEnabled();
});

test("− and + change a line, and a line taken to nothing leaves the check", async ({ page }) => {
  await openOrderPage(page);
  await add(page, "Cortado");
  await page.getByRole("button", { name: "One more Cortado" }).click();
  await expect(lineFor(page, "2 Cortado")).toBeVisible();
  await page.getByRole("button", { name: "One less Cortado" }).click();
  await page.getByRole("button", { name: "One less Cortado" }).click();
  await expect(lineFor(page, /Cortado/)).toHaveCount(0);
  await expect(submit(page)).toBeDisabled();
});

test("a check holds at most five of one thing and ten different things", async ({ page }) => {
  await openOrderPage(page);
  for (let i = 0; i < 7; i++) await add(page, "Espresso");
  await expect(lineFor(page, "5 Espresso")).toBeVisible();

  const others = ["Cortado", "Cappuccino", "Latte", "Sixty-Eight", "Drip coffee", "Cold brew", "Iced matcha", "Chai latte", "Sausage kolache", "Breakfast taco"];
  for (const name of others) await add(page, name);
  // the tenth line is Sausage kolache; a taco would have been an eleventh
  await expect(lineFor(page, /Sausage kolache/)).toBeVisible();
  await expect(lineFor(page, /Breakfast taco/)).toHaveCount(0);
});

test("the check survives a reload, and is cleared once it's on the rail", async ({ page }) => {
  await openOrderPage(page);
  await add(page, "Chai latte");
  await add(page, "Pecan sticky bun");
  await page.reload();
  await expect(lineFor(page, "1 Chai latte")).toBeVisible();
  await expect(lineFor(page, "1 Pecan sticky bun")).toBeVisible();

  await submit(page).click();
  await page.waitForURL(/\/order\/[2-9a-z]{10}$/);
  await page.getByRole("link", { name: "Order something else" }).click();
  await expect(check(page)).toContainText("Tap the board to add");
});

test("an order goes on the rail: its ticket, its check and a countdown", async ({ page }) => {
  await placeOrder(page, ["Cold brew", "Breakfast taco", "Breakfast taco"]);
  await expect(page.getByText(/^Order A-\d+ · on the rail$/)).toBeVisible();
  await expect(page.locator("dl")).toContainText("1 Cold brew");
  await expect(page.locator("dl")).toContainText("2 Breakfast taco");

  const timer = page.getByRole("timer");
  await expect(timer).toContainText(/Ready in\s*\d+:\d\d/);
  const first = await timer.innerText();
  await expect(timer, "the clock is running").not.toHaveText(first, { timeout: 5_000 });
});

test("the countdown comes down to the counter", async ({ page }) => {
  await page.clock.install();
  await placeOrder(page, ["Espresso"]);
  await expect(page.getByRole("timer")).toBeVisible();
  await page.clock.fastForward("30:00");
  await expect(page.getByRole("status")).toHaveText("Up! At the counter");
});

test("a visitor whose clock is hours out still sees the shop's wait", async ({ page }) => {
  // the browser thinks it is three hours later than it is; the countdown runs on the server's clock
  await page.clock.install({ time: Date.now() + 3 * 60 * 60_000 });
  await placeOrder(page, ["Iced matcha"]);
  const [m, s] = (await page.getByRole("timer").locator("p").last().innerText()).split(":").map(Number);
  // the check's own "Ready" box, "4m 05s": the wait the server worked out when the order went in
  const ready = await page.locator("span", { hasText: /^Ready/ }).locator("em").innerText();
  const [rm, rs] = ready.match(/\d+/g)!.map(Number);
  expect(Math.abs(m! * 60 + s! - (rm! * 60 + rs!)), "seconds between the countdown and the check's wait").toBeLessThan(10);
});

test.describe("the server checks what it's sent, whatever the page says", () => {
  // a visitor can rewrite the form before sending it; each of these is refused with a reason
  for (const [what, lines, says] of [
    ["unreadable", "not json", "That check couldn't be read."],
    ["off the board", JSON.stringify([{ itemId: "flat-white", qty: 1 }]), "Something on that check isn't on today's board."],
    ["too many of one thing", JSON.stringify([{ itemId: "latte", qty: 99 }]), /./],
  ] as const) {
    test(`a check that is ${what}`, async ({ page }) => {
      await openOrderPage(page);
      await add(page, "Latte");
      await page.locator('input[name="lines"]').evaluate((el, v) => ((el as HTMLInputElement).value = v), lines);
      await submit(page).click();
      await expect(page.locator("form").getByRole("alert")).toHaveText(says);
      await expect(page).toHaveURL(/\/order$/);
    });
  }
});

test("five orders in ten minutes, then the bar asks for a breather", async ({ page }) => {
  for (let i = 0; i < 5; i++) await placeOrder(page, ["Drip coffee"]);
  await openOrderPage(page);
  await add(page, "Drip coffee");
  await submit(page).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("That's a lot of coffee. Give the bar ten minutes to catch up.");
});

test.describe("an order that doesn't exist", () => {
  test.use({ allowedErrors: [/404/] });
  for (const id of ["not-an-id", "zzzzzzzzzz"]) {
    test(`/order/${id} is a 404`, async ({ page }) => {
      const res = await page.goto(`/order/${id}`);
      expect(res?.status()).toBe(404);
    });
  }
});
