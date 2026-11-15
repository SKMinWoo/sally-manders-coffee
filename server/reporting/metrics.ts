// The back office's figures for one Austin day, as of an instant. Every query filters through
// placedBy(asOf), so the figures are "so far": orders written ahead for later today don't count.

import { and, desc, eq, sql } from "drizzle-orm";
import { SHOP_TZ, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { menuItems, orderLines, orders } from "@/server/platform/db/schema";
import { placedBy } from "@/server/orders";

export interface DaySummary {
  orders: number;
  visitorOrders: number;
  /** net sales, before tax, in cents */
  salesCents: number;
  taxCents: number;
  /** the median and 95th-percentile wait, placed to ready, in seconds; null before the first order */
  waitP50: number | null;
  waitP95: number | null;
}

const waitSecs = sql`extract(epoch from ${orders.readyAt} - ${orders.placedAt})`;

export async function daySummary(db: Db, day: ShopDate, asOf: Date): Promise<DaySummary> {
  const [r] = await db
    .select({
      orders: sql<number>`count(*)::int`,
      visitorOrders: sql<number>`(count(*) filter (where ${orders.source} = 'visitor'))::int`,
      salesCents: sql<number>`coalesce(sum(${orders.subtotalCents}), 0)::int`,
      taxCents: sql<number>`coalesce(sum(${orders.taxCents}), 0)::int`,
      waitP50: sql<number | null>`percentile_cont(0.5) within group (order by ${waitSecs})::float8`,
      waitP95: sql<number | null>`percentile_cont(0.95) within group (order by ${waitSecs})::float8`,
    })
    .from(orders)
    .where(and(eq(orders.day, day), placedBy(asOf)));
  return {
    orders: r?.orders ?? 0,
    visitorOrders: r?.visitorOrders ?? 0,
    salesCents: r?.salesCents ?? 0,
    taxCents: r?.taxCents ?? 0,
    waitP50: r?.waitP50 ?? null,
    waitP95: r?.waitP95 ?? null,
  };
}

export interface HourCount {
  /** Austin clock hour, 0–23 (on the night the clocks go back, both 1 ams count as 1) */
  hour: number;
  orders: number;
  salesCents: number;
}

export async function ordersByHour(db: Db, day: ShopDate, asOf: Date): Promise<HourCount[]> {
  // The zone is a literal, not a parameter: Postgres matches GROUP BY to the select list by text,
  // and "$1" and "$4" don't match. SHOP_TZ is a constant in the code, never input.
  const hour = sql<number>`extract(hour from ${orders.placedAt} at time zone ${sql.raw(`'${SHOP_TZ}'`)})::int`;
  return db
    .select({ hour, orders: sql<number>`count(*)::int`, salesCents: sql<number>`sum(${orders.subtotalCents})::int` })
    .from(orders)
    .where(and(eq(orders.day, day), placedBy(asOf)))
    .groupBy(hour)
    .orderBy(hour);
}

export interface ItemSold {
  itemId: string;
  name: string;
  qty: number;
  salesCents: number;
}

/** Every item sold so far today, most first. */
export async function itemsSold(db: Db, day: ShopDate, asOf: Date): Promise<ItemSold[]> {
  const qty = sql<number>`sum(${orderLines.qty})::int`;
  return db
    .select({
      itemId: orderLines.itemId,
      name: menuItems.name,
      qty,
      salesCents: sql<number>`sum(${orderLines.qty} * ${orderLines.priceCents})::int`,
    })
    .from(orderLines)
    .innerJoin(orders, eq(orders.id, orderLines.orderId))
    .innerJoin(menuItems, eq(menuItems.id, orderLines.itemId))
    .where(and(eq(orders.day, day), placedBy(asOf)))
    .groupBy(orderLines.itemId, menuItems.name, menuItems.sort)
    .orderBy(desc(qty), menuItems.sort);
}
