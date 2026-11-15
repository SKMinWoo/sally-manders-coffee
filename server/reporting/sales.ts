// What the sales export reads: every order line placed over a span of Austin days, paged by key so
// no page ever holds more than PAGE rows, and the span's totals, counted separately so the
// export can be checked against them.

import { and, asc, between, count, eq, sql } from "drizzle-orm";
import { SHOP_TZ, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { menuItems, orderLines, orders } from "@/server/platform/db/schema";
import { placedBy } from "@/server/orders";

export type Span = { from: ShopDate; to: ShopDate };

export interface SpanStats {
  orders: number;
  lines: number;
  itemsSold: number;
  /** the orders' own subtotals, summed, in cents */
  subtotalCents: number;
  taxCents: number;
  /** the lines' qty × price, summed: equal to subtotalCents when every check adds up */
  lineTotalCents: number;
  /** the newest order in the span, so a repeat export can tell whether anything arrived */
  lastOrderId: number;
  /** orders whose lines don't add up to their subtotal, or that have no lines */
  mismatched: number;
}

const inSpan = (s: Span, asOf: Date) => and(between(orders.day, s.from, s.to), placedBy(asOf));

export async function spanStats(db: Db, span: Span, asOf: Date): Promise<SpanStats> {
  const lineTotal = sql`${orderLines.qty} * ${orderLines.priceCents}`;
  const [[o], [l], bad] = await Promise.all([
    db
      .select({
        orders: sql<number>`count(*)::int`,
        subtotalCents: sql<number>`coalesce(sum(${orders.subtotalCents}), 0)::bigint`,
        taxCents: sql<number>`coalesce(sum(${orders.taxCents}), 0)::bigint`,
        lastOrderId: sql<number>`coalesce(max(${orders.id}), 0)::bigint`,
      })
      .from(orders)
      .where(inSpan(span, asOf)),
    db
      .select({
        lines: sql<number>`count(*)::int`,
        withLines: sql<number>`count(distinct ${orderLines.orderId})::int`,
        itemsSold: sql<number>`coalesce(sum(${orderLines.qty}), 0)::int`,
        lineTotalCents: sql<number>`coalesce(sum(${lineTotal}), 0)::bigint`,
      })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .where(inSpan(span, asOf)),
    db
      .select({ n: count() })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .where(inSpan(span, asOf))
      .groupBy(orders.id, orders.subtotalCents)
      .having(sql`sum(${lineTotal}) <> ${orders.subtotalCents}`),
  ]);
  return {
    orders: o!.orders,
    lines: l!.lines,
    itemsSold: l!.itemsSold,
    // bigint sums come back as strings from some drivers
    subtotalCents: Number(o!.subtotalCents),
    taxCents: Number(o!.taxCents),
    lineTotalCents: Number(l!.lineTotalCents),
    lastOrderId: Number(o!.lastOrderId),
    mismatched: bad.length + (o!.orders - l!.withLines),
  };
}

export interface SaleLine {
  orderId: number;
  day: ShopDate;
  ticket: string;
  source: "sim" | "visitor";
  /** Austin wall clock, "YYYY-MM-DD HH:MI" */
  placedLocal: string;
  itemId: string;
  item: string;
  qty: number;
  priceCents: number;
}

export const PAGE = 2_000;

/**
 * Every line in the span, oldest order first, a page at a time. Each page starts after the last
 * key of the one before (keyset paging), so a page costs the same at row 20,000 as at row 1,
 * where OFFSET would read and throw away every row before it.
 */
export async function* saleLines(db: Db, span: Span, asOf: Date, page = PAGE): AsyncGenerator<SaleLine> {
  let after: [number, string] | null = null;
  for (;;) {
    const rows: SaleLine[] = await db
      .select({
        orderId: orders.id,
        day: orders.day,
        ticket: orders.ticket,
        source: orders.source,
        placedLocal: sql<string>`to_char(${orders.placedAt} at time zone ${sql.raw(`'${SHOP_TZ}'`)}, 'YYYY-MM-DD HH24:MI')`,
        itemId: orderLines.itemId,
        item: menuItems.name,
        qty: orderLines.qty,
        priceCents: orderLines.priceCents,
      })
      .from(orderLines)
      .innerJoin(orders, eq(orders.id, orderLines.orderId))
      .innerJoin(menuItems, eq(menuItems.id, orderLines.itemId))
      .where(and(inSpan(span, asOf), after ? sql`(${orderLines.orderId}, ${orderLines.itemId}) > (${after[0]}, ${after[1]})` : undefined))
      .orderBy(asc(orderLines.orderId), asc(orderLines.itemId))
      .limit(page);
    for (const r of rows) yield { ...r, orderId: Number(r.orderId) };
    if (rows.length < page) return;
    const last = rows[rows.length - 1]!;
    after = [Number(last.orderId), last.itemId];
  }
}
