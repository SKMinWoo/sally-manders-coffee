// A visitor's order-ahead: validated, priced from the database (never from the browser), rate
// limited, given the next ticket in the visitor series, and timed by the same wait model as the
// simulated orders, at the load the bar is under right now.

import { z } from "zod";
import { randomPublicId } from "@/lib/ids";
import { taxCents } from "@/lib/money";
import { shopToday } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { listMenu } from "@/server/menu";
import { countFromVisitor, countVisitorOrders, insertOrder } from "./repository";
import { expectedWait, loadNow } from "./wait";

export const MAX_LINES = 10;
export const MAX_QTY = 5;

/** What the browser may send: item ids and quantities, nothing else. Prices and names come from the database. */
export const OrderInput = z
  .strictObject({
    lines: z
      .array(z.strictObject({ itemId: z.string().min(1).max(40), qty: z.int().min(1).max(MAX_QTY) }))
      .min(1, "The check is empty.")
      .max(MAX_LINES, `At most ${MAX_LINES} different items on one check.`),
  })
  .refine((o) => new Set(o.lines.map((l) => l.itemId)).size === o.lines.length, "Each item goes on the check once, with its quantity.");
export type OrderInput = z.infer<typeof OrderInput>;

/** Visitors one burst can seat; past this many at the same moment, the last gets an error. */
const TICKET_TRIES = 10;

export const LIMITS = {
  /** orders one visitor can place in `windowMs` */
  perVisitor: 5,
  windowMs: 10 * 60_000,
  /** visitor orders the whole shop takes in one Austin day, which also keeps the free database tier safe */
  perDay: 300,
};

export type PlaceResult =
  | { ok: true; publicId: string; ticket: string; placedAt: Date; readyAt: Date; items: number }
  | { ok: false; reason: "invalid" | "unknown-item" | "slow-down" | "rail-full"; message: string };

/** Visitor tickets run their own daily series, A-01, A-02, …, so they never collide with the simulator's 0001, 0002, …. */
export function visitorTicket(n: number): string {
  return `A-${String(n).padStart(2, "0")}`;
}

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
};

export async function placeVisitorOrder(
  db: Db,
  raw: unknown,
  { visitorHash, now = new Date(), limits = LIMITS }: { visitorHash: string; now?: Date; limits?: typeof LIMITS },
): Promise<PlaceResult> {
  const parsed = OrderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid", message: parsed.error.issues[0]?.message ?? "That order can't go on the rail." };

  const menu = new Map((await listMenu(db)).map((m) => [m.id, m]));
  const lines = parsed.data.lines.map((l) => ({ ...l, item: menu.get(l.itemId) }));
  if (lines.some((l) => !l.item)) return { ok: false, reason: "unknown-item", message: "Something on that check isn't on today's board." };

  const day = shopToday(now);
  const [mine, today] = await Promise.all([
    countFromVisitor(db, visitorHash, new Date(+now - limits.windowMs), now),
    countVisitorOrders(db, day),
  ]);
  if (mine >= limits.perVisitor) return { ok: false, reason: "slow-down", message: "That's a lot of coffee. Give the bar ten minutes to catch up." };
  if (today >= limits.perDay) return { ok: false, reason: "rail-full", message: "The order-ahead rail is full for today. It clears at midnight, Austin time." };

  const subtotal = lines.reduce((s, l) => s + l.qty * l.item!.priceCents, 0);
  const items = lines.reduce((s, l) => s + l.qty, 0);
  const { load, pace } = await loadNow(db, now);
  const readyAt = new Date(+now + 1000 * expectedWait(items, load, pace));
  const rows = lines.map((l) => ({ itemId: l.itemId, qty: l.qty, priceCents: l.item!.priceCents }));

  // Visitors ordering at once can count the same number of tickets; the unique (day, ticket)
  // constraint refuses all but one, and the rest count again. Each round seats exactly one of them,
  // so TICKET_TRIES is how big a burst can be before someone gets an error.
  for (let attempt = 1; ; attempt++) {
    const publicId = randomPublicId();
    const ticket = visitorTicket((await countVisitorOrders(db, day)) + 1);
    try {
      await insertOrder(db, { publicId, day, ticket, source: "visitor", placedAt: now, readyAt, subtotalCents: subtotal, taxCents: taxCents(subtotal), visitorHash }, rows);
      return { ok: true, publicId, ticket, placedAt: now, readyAt, items };
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === TICKET_TRIES) throw err;
    }
  }
}
