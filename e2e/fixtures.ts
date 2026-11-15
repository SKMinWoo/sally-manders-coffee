// What every browser test shares: its own visitor, and a console that has to stay clean.

import { createHash } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";

type Fixtures = {
  /** the IP this test orders from; the rate limit (five orders in ten minutes) is per visitor */
  visitor: string;
  /** console errors a test expects, such as the 404 it asked for */
  allowedErrors: RegExp[];
};

export const test = base.extend<Fixtures>({
  allowedErrors: [[], { option: true }],

  // The shop reads a visitor's IP from x-real-ip, which on Vercel only Vercel can set. Here each
  // test (and each retry of it) sends its own, so one test's orders never count against another's.
  visitor: async ({}, provide, info) => {
    const [a, b, c] = createHash("sha256").update(`${info.testId}:${info.retry}`).digest();
    await provide(`10.${a}.${b}.${c}`);
  },
  context: async ({ context, visitor }, provide) => {
    await context.setExtraHTTPHeaders({ "x-real-ip": visitor });
    await provide(context);
  },

  // A test fails if the page threw or logged an error, even when everything it checked passed.
  page: async ({ page, allowedErrors }, provide) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`uncaught: ${e.message}`));
    page.on("console", (m) => {
      const text = `${m.text()} (${m.location().url || "the page"})`;
      if (m.type() === "error" && !allowedErrors.some((r) => r.test(text))) errors.push(text);
    });
    await provide(page);
    expect(errors, "nothing in the browser console").toEqual([]);
  },
});

export { expect };

/** The page is no wider than the screen: nothing pokes out sideways on a phone. */
export async function expectNoSidewaysScroll(page: Page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, "page width against the screen's").toBeLessThanOrEqual(client);
}

/** "$4.25" or "4.25" as cents. */
export const cents = (text: string) => Math.round(Number(text.replace(/[^0-9.]/g, "")) * 100);
