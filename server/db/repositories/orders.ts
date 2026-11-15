import { and, asc, count, eq, gt, inArray, lte, type SQL } from "drizzle-orm";
import type { ShopDate } from "@/lib/time";
import type { SimDay } from "@/server/sim/day";
import type { Db } from "../client";
import { menuItems, orderLines, orders, simDays } from "../schema";

/**
 * The one filter every read of `orders` goes through. Simulated days are written ahead of time
 * (docs/decisions/0002), so without it a read would show orders that haven't happened yet.
 */
export function placedBy(asOf: Date): SQL {
  return lte(orders.placedAt, asOf);
}

/** Orders placed on `day` up to `asOf`. */
export async function countOrders(db: Db, day: ShopDate, asOf: Date): Promise<number> {
  const [row] = await db.select({ n: count() }).from(orders).where(and(eq(orders.day, day), placedBy(asOf)));
  return row?.n ?? 0;
}

/** Orders placed after `from` and up to `asOf`, whatever their day: how busy the counter is right now. */
export async function countPlacedBetween(db: Db, from: Date, asOf: Date): Promise<number> {
  const [row] = await db.select({ n: count() }).from(orders).where(and(gt(orders.placedAt, from), placedBy(asOf)));
  return row?.n ?? 0;
}

/** Visitor orders placed on `day` up to `asOf`: how full the order-ahead rail is. */
export async function countVisitorOrders(db: Db, day: ShopDate, asOf: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.day, day), eq(orders.source, "visitor"), placedBy(asOf)));
  return row?.n ?? 0;
}

/** Orders from one visitor (by hash) after `from` and up to `asOf`: for the per-visitor rate limit. */
export async function countFromVisitor(db: Db, visitorHash: string, from: Date, asOf: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.visitorHash, visitorHash), gt(orders.placedAt, from), placedBy(asOf)));
  return row?.n ?? 0;
}

export type NewOrder = Omit<typeof orders.$inferInsert, "id">;
export type NewLine = Omit<typeof orderLines.$inferInsert, "orderId">;

/**
 * One order and its lines. Without transactions, the order goes in first and is removed again if
 * its lines fail, so no order is ever left without lines.
 */
export async function insertOrder(db: Db, order: NewOrder, lines: NewLine[]): Promise<void> {
  const [row] = await db.insert(orders).values(order).returning({ id: orders.id });
  try {
    await db.insert(orderLines).values(lines.map((l) => ({ ...l, orderId: row!.id })));
  } catch (err) {
    await db.delete(orders).where(eq(orders.id, row!.id));
    throw err;
  }
}

export interface OrderView {
  publicId: string;
  day: ShopDate;
  ticket: string;
  source: "sim" | "visitor";
  placedAt: Date;
  readyAt: Date;
  subtotalCents: number;
  taxCents: number;
  lines: { itemId: string; name: string; qty: number; priceCents: number }[];
}

/** One order by its public id, with its lines in board order; undefined if there is none (yet). */
export async function findOrder(db: Db, publicId: string, asOf: Date): Promise<OrderView | undefined> {
  const [o] = await db
    .select({
      id: orders.id,
      publicId: orders.publicId,
      day: orders.day,
      ticket: orders.ticket,
      source: orders.source,
      placedAt: orders.placedAt,
      readyAt: orders.readyAt,
      subtotalCents: orders.subtotalCents,
      taxCents: orders.taxCents,
    })
    .from(orders)
    .where(and(eq(orders.publicId, publicId), placedBy(asOf)));
  if (!o) return undefined;
  const lines = await db
    .select({ itemId: orderLines.itemId, name: menuItems.name, qty: orderLines.qty, priceCents: orderLines.priceCents })
    .from(orderLines)
    .innerJoin(menuItems, eq(menuItems.id, orderLines.itemId))
    .where(eq(orderLines.orderId, o.id))
    .orderBy(asc(menuItems.sort));
  const { id: _id, ...rest } = o;
  return { ...rest, lines };
}

// Rows per insert: well under Postgres's 65,535 bind parameters, and small enough for one
// HTTP request to Neon.
const CHUNK = 250;

/**
 * Writes a simulated day, unless it is already written. Without interactive transactions (Neon's
 * HTTP driver has none), safety comes from order: the day is only marked written after every
 * order and line is in, and a day that was left half-written is cleared and written again. The
 * simulator is deterministic, so the rewrite is the same day, public ids included.
 */
export async function writeSimDay(db: Db, day: SimDay): Promise<"written" | "already"> {
  const done = await db.select({ day: simDays.day }).from(simDays).where(eq(simDays.day, day.date));
  if (done.length > 0) return "already";

  await db.delete(orders).where(and(eq(orders.day, day.date), eq(orders.source, "sim")));

  for (let i = 0; i < day.orders.length; i += CHUNK) {
    const chunk = day.orders.slice(i, i + CHUNK);
    const ids = await db
      .insert(orders)
      .values(chunk.map((o) => ({
        publicId: o.publicId,
        day: day.date,
        ticket: o.ticket,
        source: "sim" as const,
        placedAt: o.placedAt,
        readyAt: o.readyAt,
        subtotalCents: o.subtotalCents,
        taxCents: o.taxCents,
      })))
      .returning({ id: orders.id, publicId: orders.publicId });
    const idOf = new Map(ids.map((r) => [r.publicId, r.id]));
    await db.insert(orderLines).values(
      chunk.flatMap((o) => o.lines.map((l) => ({ orderId: idOf.get(o.publicId)!, itemId: l.itemId, qty: l.qty, priceCents: l.priceCents }))),
    );
  }

  await db.insert(simDays).values({ day: day.date, seed: day.seed, orders: day.orders.length }).onConflictDoNothing();
  return "written";
}

/** Which of these days the simulator has already written. */
export async function writtenDays(db: Db, days: ShopDate[]): Promise<Set<ShopDate>> {
  if (days.length === 0) return new Set();
  const rows = await db.select({ day: simDays.day }).from(simDays).where(inArray(simDays.day, days));
  return new Set(rows.map((r) => r.day));
}
