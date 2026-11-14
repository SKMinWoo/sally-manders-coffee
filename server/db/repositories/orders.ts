import { and, count, eq, gt, inArray, lte, type SQL } from "drizzle-orm";
import type { ShopDate } from "@/lib/time";
import type { SimDay } from "@/server/sim/day";
import type { Db } from "../client";
import { orderLines, orders, simDays } from "../schema";

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
