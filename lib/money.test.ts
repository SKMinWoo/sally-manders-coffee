import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatPrice, taxCents } from "./money";

test("the guest check from the mockup adds up: $10.25 + $0.85 tax = $11.10", () => {
  const subtotal = 625 + 400; // house signature and a sausage kolache
  const tax = taxCents(subtotal);
  assert.equal(tax, 85);
  assert.equal(formatMoney(subtotal + tax), "$11.10");
});

test("tax rounds half up, once per order", () => {
  assert.equal(taxCents(0), 0);
  assert.equal(taxCents(100), 8); // 8.25 cents
  assert.equal(taxCents(200), 17); // 16.5 cents rounds up
  assert.equal(taxCents(1000), 83); // 82.5 cents rounds up
});

test("tax refuses anything but whole, non-negative cents", () => {
  assert.throws(() => taxCents(10.5), RangeError);
  assert.throws(() => taxCents(-1), RangeError);
});

test("formatting", () => {
  assert.equal(formatMoney(175875, { whole: true }), "$1,759");
  assert.equal(formatMoney(682), "$6.82");
  assert.equal(formatPrice(625), "6.25");
  assert.equal(formatPrice(300), "3.00");
});
