// Simulates one Austin day at the counter, order by order. The same date always gives the same
// day: the generator is seeded from it, so a day can be rewritten after a failed run and come out
// identical, and tests can pin exact figures.

import { publicIdFrom } from "@/lib/ids";
import { taxCents } from "@/lib/money";
import { hoursOf, weekdayOf, type ShopDate } from "@/lib/time";
import { capacityAt, demandAt } from "./demand";
import { daypartOf, MENU } from "@/server/menu";
import { tuning, type LeverId } from "./levers";
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
  /** the levers it was simulated with; absent for a day simulated the original way, with none */
  levers?: LeverId[];
}

/**
 * Seconds from paying to the cup on the counter. Bigger orders take longer, and once an hour's
 * orders pass about half of what the bar can make, a queue builds and waits climb steeply.
 * `noise` is a standard normal draw, so waits vary by about 30% either way. `baseSeconds` and
 * `itemSeconds` are the levers' to change (levers.ts); left out, they are the shop's usual pace.
 */
export function waitSeconds({ items, load, noise, baseSeconds = 80, itemSeconds = 34 }: { items: number; load: number; noise: number; baseSeconds?: number; itemSeconds?: number }): number {
  return Math.round((baseSeconds + itemSeconds * items + 150 * Math.max(0, load - 0.55) ** 1.5) * Math.exp(0.3 * noise));
}

/**
 * Simulates the day. Without `levers` it is the original day: one random stream, drawn in order,
 * which every day written before the board (and every test pinned to one) relies on.
 *
 * With `levers` (even none), every hour and every order in it draws from a stream of its own,
 * seeded from the date, the hour and the order's place in the hour. So the same day simulated with
 * and without a lever shares its guests: the third order at 8 am is the same person ordering the
 * same things in both, and when a lever brings more people in, the extra ones are the only
 * difference. That is what lets a change be measured against the same week without it (server/board).
 */
export function simulateDay(date: ShopDate, levers?: readonly LeverId[]): SimDay {
  const seed = seedOf(date);
  const shared = rngFrom(seed);
  const t = tuning(levers ?? []);
  const weekday = weekdayOf(date);
  const drafts: Omit<SimOrder, "ticket">[] = [];

  hoursOf(date).forEach(({ hour, start }, h) => {
    const hourRng = levers ? rngFrom(seedOf(`${date}#${h}`)) : shared;
    const n = hourRng.poisson(demandAt({ hour, weekday }) * t.demand(hour));
    const load = n / t.capacity(hour, capacityAt(hour));
    const part = daypartOf(hour);
    for (let i = 0; i < n; i++) {
      const rng = levers ? rngFrom(seedOf(`${date}#${h}#${i}`)) : shared;
      const size = rng.next() < t.oneItem(hour) ? 1 : rng.next() < 0.75 ? 2 : 3;
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
      const wait = waitSeconds({ items: size, load, noise: rng.gauss(), baseSeconds: t.baseSeconds, itemSeconds: t.itemSeconds });
      drafts.push({
        publicId: publicIdFrom(rng.next),
        placedAt,
        readyAt: new Date(placedAt.getTime() + wait * 1000),
        lines,
        subtotalCents,
        taxCents: taxCents(subtotalCents),
      });
    }
  });

  // tickets are numbered in the order they were rung up (Array.sort is stable, so ties keep
  // their generation order and the numbering is as repeatable as the rest)
  drafts.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());
  const orders = drafts.map((d, i) => ({ ...d, ticket: String(i + 1).padStart(4, "0") }));
  return levers ? { date, seed, orders, levers: [...levers].sort() } : { date, seed, orders };
}
