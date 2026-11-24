// The work: the board as a visitor meets it. The e2e database starts empty, so the shop rehearses a
// fortnight of mornings as it opens (server/board/rehearse.ts), and the board has a change measured
// and another being tried before the first test looks.

import { expect, expectNoSidewaysScroll, test } from "./fixtures";

test("the board hangs four columns, with a change measured and one being tried", async ({ page }) => {
  await page.goto("/board");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The work");
  await expect(page.getByText(/^The work · \w{3} \d+ \w{3} · a simulated shop$/)).toBeVisible();

  const board = page.getByRole("list", { name: "The board" });
  for (const name of ["Heard", "Planned", "Trying", "Measured"]) await expect(board.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(board.getByText(/^Day [1-7] of 7$/i)).toBeVisible();
  // while one is tried, Planned says when the next is chosen and what's still on the list
  await expect(board.getByText(/^Chosen \w{3} \d+ \w{3}$/)).toBeVisible();
  await expect(board.getByText("Still on the list")).toBeVisible();
  await expect(board.getByText(/^(Kept|Taken back)$/).first()).toBeVisible();
  await expect(board.getByText(/, heard (once|\d+ times)$/).first()).toBeAttached();
  await expectNoSidewaysScroll(page);
});

test("this morning's two calls are on the floor, every figure a link that answers", async ({ page, request }) => {
  await page.goto("/board");
  const morning = page.getByRole("region", { name: /the morning call$/ });
  const notes = morning.getByRole("figure");
  await expect(notes).toHaveCount(2);
  // the regular, then the manager's reply; who wrote them is said once under both when it's the same
  // writer (here the templates, since no model is set up), else under each
  await expect(notes.nth(0)).toContainText("a regular:");
  await expect(notes.nth(1)).toContainText("The manager, in reply");
  const captions = await morning.locator("figcaption").count();
  if (captions === 0) await expect(morning.getByText(/^Both written (by|from)/)).toBeVisible();
  else {
    await expect(notes.nth(0).locator("figcaption")).toContainText(/regular’s call|Written by/);
    await expect(notes.nth(1).locator("figcaption")).toContainText(/manager’s reply|Written by/);
  }

  const hrefs = new Set(await morning.locator("blockquote a").evaluateAll((as) => as.map((a) => a.getAttribute("href")!)));
  expect(hrefs.size, "the calls cite their figures").toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, "a figure points at the shop's own API").toMatch(/^\/api\/v1\//);
    expect((await request.get(href)).status(), `${href} answers`).toBe(200);
  }
});

test("the earlier calls say what the manager did, open to what was said, and the call that chose each change is among them", async ({ page }) => {
  await page.goto("/board");
  // the newest five are out on the floor, the rest of the four weeks fold under one line
  const older = page.locator("details", { has: page.locator("> summary", { hasText: /^\d+ earlier calls$/ }) });
  if (await older.count()) await older.locator("> summary").click();
  const decided = page.locator("details:not(:has(details)) > summary").getByText(/^(chose .+|held(, with .+ still on trial)?)$/);
  await expect(decided.first()).toBeVisible();
  const chosen = page.locator("details:not(:has(details))", { has: page.locator("> summary", { hasText: /chose / }) });
  await expect(chosen).not.toHaveCount(0);
  const first = chosen.first();
  await first.locator("> summary").click();
  await expect(first.locator("blockquote").first()).toBeVisible();
});

test("the board is open as data", async ({ request }) => {
  const res = await request.get("/api/v1/board");
  expect(res.status()).toBe(200);
  const b = await res.json();
  expect(b.trying ?? b.planned, "something is being worked on").toBeTruthy();
  expect(b.measured.length).toBeGreaterThan(0);
  expect(b.latest.customer.template, "written with keys").toMatch(/\{\w+\}/);
  expect(b.latest.customer.text, "read with the figures filled in").not.toMatch(/\{\w+\}/);
});

test("the front page says what the manager is working on, and links to it", async ({ page }) => {
  await page.goto("/");
  const line = page.getByText(/^(This week the manager is trying|From .+ the manager is trying|The newest change kept)/);
  await expect(line).toBeVisible();
  await page.getByRole("link", { name: "See the work →" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("The work");
});

test("the header reaches the work from any page, and fits on a phone", async ({ page }) => {
  await page.goto("/behind");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "The work" }).click();
  await expect(page).toHaveURL(/\/board$/);
  await expect(page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "The work" })).toHaveAttribute("aria-current", "page");
  // the lockup and the switch share a row on a phone; neither may run under the other
  const gap = await page.evaluate(() => {
    const word = document.querySelector("header [class*=wordmark]")!.getBoundingClientRect();
    const nav = document.querySelector("nav[aria-label=Sections]")!.getBoundingClientRect();
    return word.bottom <= nav.top || nav.bottom <= word.top ? Infinity : nav.left - word.right;
  });
  expect(gap, "space between the wordmark and the switch").toBeGreaterThanOrEqual(4);
  await expectNoSidewaysScroll(page);
});
