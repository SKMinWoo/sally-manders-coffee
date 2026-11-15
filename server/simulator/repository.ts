// What the simulator writes: its days, whole or not at all. The orders and lines go into the same
// tables visitors' orders do (source "sim"), but only the simulator ever writes or clears a
// simulated day, so the code that does it lives here, not in the orders module.

import { and, eq, inArray } from "drizzle-orm";
import type { ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { orderLines, orders, simDays } from "@/server/platform/db/schema";
import type { SimDay } from "./day";

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
