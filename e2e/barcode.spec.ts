// Exhibit 8: every barcode is checked the way a scanner checks it, from the pixels. An order's own
// check is screenshotted and read back; so is a sheet of barcodes at several sizes and angles;
// and damaged ones must be refused, never read as something else. Each test tallies what it saw
// for the back office (scripts/ci/barcode-facts.mjs), before it asserts, so a failing run is
// counted as honestly as a passing one.

import type { Locator, Page } from "@playwright/test";
import { bars, decodeRow, encode, QUIET } from "@/lib/code128";
import { publicIdFrom } from "@/lib/ids";
import { expect, placeOrder, test } from "./fixtures";
import { readPng, rowAt } from "./png";

/** right: read as what it says (or, damaged, refused); wrong: read as anything else. */
type Tally = { kind: "page" | "generated" | "damaged"; shown: number; right: number; wrong: number };
const tally = (t: Tally) => test.info().annotations.push({ type: "barcodes", description: JSON.stringify(t) });

/**
 * Read a screenshot as a scanner would: across three rows. One answer from them all, or null; two
 * different answers is a misread, reported as such.
 */
function scan(png: Buffer): string | null {
  const picture = readPng(png);
  const reads = new Set([0.3, 0.5, 0.7].map((f) => decodeRow(rowAt(picture, f))));
  reads.delete(null);
  if (reads.size > 1) return `misread: ${[...reads].join(" / ")}`;
  return reads.values().next().value ?? null;
}

const PAPER = "#EEF1DE", INK = "#26412F"; // the guest check's

test("the barcode on an order's check reads back as that order's id, from a screenshot", async ({ page }) => {
  await placeOrder(page, ["Latte", "Pecan sticky bun"]);
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const figure = page.locator("figure[data-barcode]");
  await expect(figure.locator("figcaption"), "the id written under it").toHaveText(id);

  // the bars and ten modules of paper either side: anything else in the quiet zone breaks the read
  await figure.scrollIntoViewIfNeeded();
  const box = (await figure.locator("svg").boundingBox())!;
  const quiet = (box.width / (bars(id).modules - 2 * QUIET)) * QUIET;
  const shot = await page.screenshot({ clip: { x: box.x - quiet, y: box.y, width: box.width + 2 * quiet, height: box.height } });
  const got = scan(shot);
  tally({ kind: "page", shown: 1, right: got === id ? 1 : 0, wrong: got !== null && got !== id ? 1 : 0 });
  expect(got, "the id, read from the pixels").toBe(id);
});

/** A sheet of barcodes drawn as the check draws them, each on its own bit of check paper. */
async function sheet(page: Page, cards: { widths: number[]; size: number; angle: number }[]): Promise<Locator[]> {
  const svg = (widths: number[], size: number) => {
    let x = 0, d = "";
    widths.forEach((w, i) => {
      if (i % 2 === 0) d += `M${x} 0h${w}v1h-${w}z`;
      x += w;
    });
    return `<svg viewBox="0 0 ${x} 1" width="${x * size}" height="44" preserveAspectRatio="none"><path d="${d}" fill="currentColor"/></svg>`;
  };
  await page.setContent(`<body style="margin:0;background:${PAPER};color:${INK}">${cards
    .map((c, i) => `<div id="c${i}" style="display:inline-block;margin:24px;padding:4px ${QUIET * c.size}px;rotate:${c.angle}deg">${svg(c.widths, c.size)}</div>`)
    .join("")}</body>`);
  return cards.map((_, i) => page.locator(`#c${i}`));
}

/** The same ids every run, from a seeded source, the way the simulator makes its own. */
function ids(n: number) {
  let seed = 5;
  const next = () => ((seed = (seed * 48271) % 2147483647) - 1) / 2147483646;
  return Array.from({ length: n }, () => publicIdFrom(next));
}

const SIZES = [1.5, 2, 3]; // CSS pixels a module; the check uses 2
const ANGLES = [0, 2, -4]; // the check hangs at 2°

test("a sheet of barcodes reads back at every size and angle", async ({ page }) => {
  const texts = [...ids(3), "ab"]; // "ab" has a check of 95, past every printable character
  const cards = texts.flatMap((text) => SIZES.flatMap((size) => ANGLES.map((angle) => ({ text, widths: encode(text), size, angle }))));
  const located = await sheet(page, cards);
  const misses: string[] = [];
  let read = 0, misread = 0;
  for (const [i, card] of cards.entries()) {
    const got = scan(await located[i]!.screenshot());
    if (got === card.text) read++;
    else {
      if (got !== null) misread++;
      misses.push(`${card.text} at ${card.size}px, ${card.angle}°: ${got}`);
    }
  }
  tally({ kind: "generated", shown: cards.length, right: read, wrong: misread });
  expect(misses, "every barcode on the sheet").toEqual([]);
});

test("a damaged barcode is refused, never read as something else", async ({ page }) => {
  const [id] = ids(1) as [string];
  const good = encode(id);
  const space = good.findIndex((w, i) => i > 6 && i % 2 === 1 && w >= 3); // a space a stroke fits in, past the start
  const damage: Record<string, number[]> = {
    "a bar a module too wide": good.map((w, i) => (i === 14 ? w + 1 : w)),
    "two characters swapped": [...good.slice(0, 6), ...good.slice(12, 18), ...good.slice(6, 12), ...good.slice(18)],
    "the stop torn off": good.slice(0, -7),
    "an ink stroke across a space": good.flatMap((w, i) => (i === space ? [1, 1, w - 2] : [w])),
  };
  expect(space, "a space wide enough for the stroke").toBeGreaterThan(0);
  const cards = Object.entries(damage).flatMap(([what, widths]) => [2, 3].flatMap((size) => [0, 2].map((angle) => ({ what, widths, size, angle }))));
  const located = await sheet(page, cards);
  const read: string[] = [];
  for (const [i, card] of cards.entries()) {
    const got = scan(await located[i]!.screenshot());
    if (got !== null) read.push(`${card.what} at ${card.size}px, ${card.angle}°: ${got}`);
  }
  tally({ kind: "damaged", shown: cards.length, right: cards.length - read.length, wrong: read.length });
  expect(read, "damaged barcodes that read as anything").toEqual([]);
});
