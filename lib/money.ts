// Money is whole cents everywhere: in the database, the simulator, the API. Floats only appear
// at the edge, when a figure is formatted for a person to read. See docs/decisions/0003.

/** Austin's combined sales tax: 6.25% state, 1% city, 1% transit. In basis points. */
export const TAX_RATE_BP = 825;

/** Tax on one order, rounded once per order to the nearest cent (half up), as a till does. */
export function taxCents(subtotalCents: number): number {
  if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
    throw new RangeError(`subtotal must be a whole, non-negative number of cents, got ${subtotalCents}`);
  }
  return Math.floor((subtotalCents * TAX_RATE_BP) / 10_000 + 0.5);
}

/** "$11.10", or "$1,759" with `whole`, for headline figures. */
export function formatMoney(cents: number, { whole = false } = {}): string {
  const digits = whole ? 0 : 2;
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** "6.25", the way a menu board prints a price: no dollar sign. */
export function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2);
}
