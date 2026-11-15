import { test } from "node:test";
import assert from "node:assert/strict";
import { bars, decodeRow, encode, QUIET, TABLE } from "./code128";
import { randomPublicId } from "./ids";

const sum = (s: string) => [...s].reduce((a, c) => a + Number(c), 0);

test("the table keeps Code 128's own rules: 11 modules a symbol, even bars, no two alike", () => {
  assert.equal(TABLE.symbols.length, 106);
  for (const [v, s] of TABLE.symbols.entries()) {
    assert.match(s, /^[1-4]{6}$/, `symbol ${v}`);
    assert.equal(sum(s), 11, `symbol ${v} is 11 modules`);
    assert.equal((Number(s[0]) + Number(s[2]) + Number(s[4])) % 2, 0, `symbol ${v}'s bars add up to an even number`);
  }
  assert.equal(new Set(TABLE.symbols).size, 106, "every symbol is different");
  assert.equal(sum(TABLE.stop), 13);
  assert.ok(!TABLE.symbols.includes(TABLE.stop.slice(0, 6) as never), "the stop can't be read as a symbol");
});

test("a barcode is start B, the characters, the check worked out by hand, and the stop", () => {
  // "ab": a is 65 and b is 66 in set B, so the check is (104 + 65×1 + 66×2) mod 103 = 95
  const w = encode("ab").join("");
  assert.equal(w, ["211214", TABLE.symbols[65], TABLE.symbols[66], TABLE.symbols[95], "2331112"].join(""));
  assert.equal(TABLE.symbols[95], "114113");
  assert.equal(decodeRow(raster("ab", 2)), "ab", "a check above 94, which no character can be, still reads");
  assert.throws(() => encode(""), RangeError);
  assert.throws(() => encode("café"), RangeError, "é isn't in set B");
});

test("the bars sit inside a quiet zone of ten modules each side", () => {
  const { modules, bars: b } = bars("a2");
  assert.equal(b[0]!.x, QUIET);
  const last = b.at(-1)!;
  assert.equal(modules - (last.x + last.w), QUIET);
  assert.equal(modules, QUIET * 2 + 11 * 4 + 13, "start, two characters, check and stop");
});

/**
 * Lay a barcode out on a row of pixels, as a screen would: `scale` pixels to a module from
 * `offset`, with each pixel taking the share of ink that falls on it, so edges come out grey.
 */
function raster(text: string, scale: number, offset = 0.37, ink = 47, paper = 238): number[] {
  const { modules, bars: b } = bars(text);
  const row = new Array(Math.ceil(modules * scale + offset * 2)).fill(0);
  for (const { x, w } of b) {
    const from = offset + x * scale, to = from + w * scale;
    for (let p = Math.floor(from); p < Math.ceil(to); p++) row[p] += Math.min(p + 1, to) - Math.max(p, from);
  }
  return row.map((cover) => paper - (paper - ink) * Math.min(1, cover));
}

test("it reads back every public id at any scale, blurred edges and all", () => {
  for (const scale of [1.5, 2, 2.625, 3, 3.5, 4.2, 7]) {
    for (let i = 0; i < 40; i++) {
      const id = randomPublicId();
      assert.equal(decodeRow(raster(id, scale, (i % 10) / 10)), id, `${id} at ${scale}px a module`);
    }
  }
  assert.equal(decodeRow(raster("A-07 Sally Mander's", 2)), "A-07 Sally Mander's");
});

test("a damaged barcode reads as nothing, never as something else", () => {
  const id = "k7m2pq9rst";
  const good = encode(id);
  const rowOf = (widths: number[]) => {
    const scale = 3, row: number[] = new Array(QUIET * scale).fill(238);
    widths.forEach((w, i) => row.push(...new Array(w * scale).fill(i % 2 ? 238 : 47)));
    return [...row, ...new Array(QUIET * scale).fill(238)];
  };
  assert.equal(decodeRow(rowOf(good)), id, "the undamaged one reads");

  const widened = [...good];
  widened[14] = widened[14]! + 1; // one bar a module wider, in the second character
  assert.equal(decodeRow(rowOf(widened)), null, "a bar too wide");

  const swapped = [...good];
  swapped.splice(6, 12, ...good.slice(12, 18), ...good.slice(6, 12)); // the first two characters swapped
  assert.equal(decodeRow(rowOf(swapped)), null, "two characters swapped: the check catches it");

  assert.equal(decodeRow(rowOf(good.slice(0, -7))), null, "the stop torn off");
  assert.equal(decodeRow(rowOf(good).reverse()), null, "read backwards");
  assert.equal(decodeRow(new Array(400).fill(238)), null, "blank paper");
  assert.equal(decodeRow(rowOf(good).map((p) => (p > 100 ? 140 : 110))), null, "too faint to trust");
});
