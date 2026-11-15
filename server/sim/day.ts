// Simulates one Austin day at the counter, order by order. The same date always gives the same
// day: the generator is seeded from it, so a day can be rewritten after a failed run and come out
// identical, and tests can pin exact figures.

import { publicIdFrom } from "@/lib/ids";
import { taxCents } from "@/lib/money";
import { hoursOf, weekdayOf, type ShopDate } from "@/lib/time";
import { capacityAt, demandAt } from "./demand";
import { daypartOf, MENU } from "./menu";
import { rngFrom, seedOf } from "./rng";

export interface OrderLine {
  itemId: string;
  qty: number;
  priceCents: number;
}

export interface SimOrder {
  publicId: string;
  ticket: string;
  placedAt: Date;
  readyAt: Date;
  lines: OrderLine[];
  subtotalCents: number;
  taxCents: number;
}

export interface SimDay {
  date: ShopDate;
  seed: number;
  orders: SimOrder[];
}

/**
 * Seconds from paying to the cup on the counter. Bigger orders take longer, and once an hour's
 * orders pass about half of what the bar can make, a queue builds and waits climb steeply.
 * `noise` is a standard normal draw, so waits vary by about 30% either way.
 */
export function waitSeconds({ items, load, noise }: { items: number; load: number; noise: number }): number {
  return Math.round((80 + 34 * items + 150 * Math.max(0, load - 0.55) ** 1.5) * Math.exp(0.3 * noise));
}

export function simulateDay(date: ShopDate): SimDay {
  const seed = seedOf(date);
  const rng = rngFrom(seed);
  const weekday = weekdayOf(date);
  const drafts: Omit<SimOrder, "ticket">[] = [];

  for (const { hour, start } of hoursOf(date)) {
    const n = rng.poisson(demandAt({ hour, weekday }));
    const load = n / capacityAt(hour);
    const part = daypartOf(hour);
    for (let i = 0; i < n; i++) {
      const size = rng.next() < 0.62 ? 1 : rng.next() < 0.75 ? 2 : 3;
      const qty = new Map<string, number>();
      for (let j = 0; j < size; j++) {
        const item = rng.pick(MENU, (m) => m.w[part]);
        qty.set(item.id, (qty.get(item.id) ?? 0) + 1);
      }
      const lines = [...qty].map(([itemId, q]) => ({
        itemId,
        qty: q,
        priceCents: MENU.find((m) => m.id === itemId)!.priceCents,
      }));
      const subtotalCents = lines.reduce((s, l) => s + l.qty * l.priceCents, 0);
      const placedAt = new Date(start.getTime() + Math.floor(rng.next() * 3600) * 1000);
      const wait = waitSeconds({ items: size, load, noise: rng.gauss() });
      drafts.push({
        publicId: publicIdFrom(rng.next),
        placedAt,
        readyAt: new Date(placedAt.getTime() + wait * 1000),
        lines,
        subtotalCents,
        taxCents: taxCents(subtotalCents),
      });
    }
  }

  // tickets are numbered in the order they were rung up (Array.sort is stable, so ties keep
  // their generation order and the numbering is as repeatable as the rest)
  drafts.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
  const orders = drafts.map((d, i) => ({ ...d, ticket: String(i + 1).padStart(4, "0") }));
  return { date, seed, orders };
}
