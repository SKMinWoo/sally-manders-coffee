# 3. Money is stored and computed in whole cents

Date: 2026-11-14 · Status: accepted

## Context

The first simulator added prices as floating-point dollars. A day's takings came out as
1758.7500000000002 and had to be rounded for display, and the rounding happened in different
places for different figures.

## Decision

Every amount is an integer number of cents: menu prices, line items, subtotals, tax, totals, in
the database and in the API. Tax is Austin's 8.25%, rounded half up once per order, as a till
does, never per line. Formatting into dollars happens only where a person reads the figure
(`lib/money.ts`).

## Consequences

- Totals reconcile exactly: a day's takings equal the sum of its orders, which equal the sum of
  their lines plus tax. The simulator's tests check this.
- API consumers get `*_cents` fields and format them themselves.
