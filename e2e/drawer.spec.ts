// Ordering from beside the model: the round Order button on the home page pulls the board out (a
// drawer on a wide screen, a sheet on a phone), the order goes on the rail without leaving the page,
// and the visitor's own guest walks in on the model. Every order here really goes into the database.

import type { Page } from "@playwright/test";
import { expect, placeOrder, test } from "./fixtures";

const drawer = (page: Page) => page.locator("#order-drawer");
const orderButton = (page: Page) => page.getByRole("button", { name: "Order", exact: true });
const add = (page: Page, name: string) => drawer(page).getByRole("button", { name: new RegExp(`^Add ${name},`) }).click();
const submit = (page: Page) => drawer(page).getByRole("button", { name: "Put it on the rail" });

/** The home page, hydrated, so a tap on the button reaches React instead of a dead element. */
async function openHome(page: Page) {
  await page.goto("/");
  await page.waitForFunction(() => {
    const b = document.querySelector('button[aria-controls="order-drawer"]');
    return !!b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
  });
  // on a phone the token stands back while the first act's "Order ahead" is in sight, so scroll on
  // past that link, as a visitor would, until the token comes up
  await page.evaluate(() => {
    if (!matchMedia("(max-width: 1000px)").matches) return;
    const cta = document.querySelector("[data-order-cta]")!.getBoundingClientRect();
    scrollBy(0, cta.bottom);
  });
  await expect(orderButton(page)).toBeVisible();
}

test("on a phone the token stands back while the shop's own Order ahead is in sight", async ({ page, isMobile }) => {
  test.skip(!isMobile, "wide, the token sits on the model's corner and never covers the copy");
  await page.goto("/");
  await expect(page.locator("[data-order-cta]")).toBeInViewport();
  await expect(orderButton(page)).toBeHidden();
});

async function openDrawer(page: Page) {
  await openHome(page);
  await orderButton(page).click();
  await expect(drawer(page)).toHaveAttribute("data-open", "");
  await expect(drawer(page).getByRole("heading", { name: "Order here" })).toBeFocused();
}

test("the Order button opens the board beside the model, and Escape puts it away", async ({ page }) => {
  await openHome(page);
  // shut, the drawer is out of the way: nothing in it can be tabbed to or read
  await expect(drawer(page)).toHaveAttribute("inert", "");
  await expect(orderButton(page)).toHaveAttribute("aria-expanded", "false");
  // the button is its own thing; the two "Order ahead" links to the order page are still there
  await expect(page.getByRole("link", { name: "Order ahead" })).toHaveCount(2);

  await orderButton(page).click();
  await expect(drawer(page)).toHaveAttribute("data-open", "");
  await expect(drawer(page)).not.toHaveAttribute("inert", "");
  await expect(drawer(page).getByRole("heading", { name: "Order here" })).toBeFocused();
  // the drawer's board has its own ids, so the page's #board (Today's board, further down) stays one
  await expect(page.locator("#board")).toHaveCount(1);
  await expect(page.locator("#drawer-board")).toHaveCount(1);
  // the model is still on screen beside (or above) it
  await expect(page.locator("#sally-model")).toBeInViewport({ ratio: 0.5 });

  await page.keyboard.press("Escape");
  await expect(drawer(page)).toHaveAttribute("inert", "");
  await expect(orderButton(page)).toBeFocused();
  await expect(orderButton(page)).toHaveAttribute("aria-expanded", "false");
});

test("the close button shuts it too", async ({ page }) => {
  await openDrawer(page);
  await drawer(page).getByRole("button", { name: "Close the order" }).click();
  await expect(drawer(page)).toHaveAttribute("inert", "");
  await expect(orderButton(page)).toBeFocused();
});

test("an order from the drawer goes on the rail, and its guest walks in on the model", async ({ page }) => {
  await openDrawer(page);
  await expect(submit(page)).toBeDisabled();
  await add(page, "Latte");
  await add(page, "Sausage kolache");
  await expect(drawer(page).locator("form dl")).toContainText("1 Latte");
  await submit(page).click();

  // the drawer answers in place: no page change
  const status = drawer(page).getByRole("status");
  await expect(status.getByText(/^Order A-\d+ · on the rail$/)).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(status.getByRole("link", { name: /Follow your order/ })).toHaveAttribute("href", /^\/order\/[2-9a-z]{10}$/);
  const first = await status.locator("p").nth(1).innerText();
  await expect(status.locator("p").nth(1), "the countdown is running").not.toHaveText(first, { timeout: 5_000 });

  // the visitor's own guest sets off at once, not half a minute later with everyone else's
  await expect(page.locator("#sally-model svg title", { hasText: "Your order" })).toHaveCount(1, { timeout: 5_000 });

  // and the check starts over for the next one
  await status.getByRole("button", { name: "Order something else" }).click();
  await expect(drawer(page).locator("form dl")).toContainText("Tap the board to add");
});

test("the drawer shares the order page's check", async ({ page }) => {
  await openDrawer(page);
  await add(page, "Chai latte");
  await page.goto("/order");
  await expect(page.locator("form dl")).toContainText("1 Chai latte");
});

test("the drawer keeps to the same limits as the order page", async ({ page }) => {
  for (let i = 0; i < 5; i++) await placeOrder(page, ["Drip coffee"]);
  await openDrawer(page);
  await add(page, "Drip coffee");
  await submit(page).click();
  await expect(drawer(page).getByRole("alert")).toHaveText("That's a lot of coffee. Give the bar ten minutes to catch up.");
  await expect(drawer(page).getByRole("status")).toHaveCount(0);
});
