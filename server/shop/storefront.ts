// What the storefront reads, cached so a burst of visitors costs the database one query a minute.
// The menu changes only on a deploy; the pulse (the next ticket number and the wait) moves with
// the simulated day, so a minute stale is fine.

import { unstable_cache } from "next/cache";
import { shopToday, type ShopDate } from "@/lib/time";
import { shopDb } from "@/server/db/client";
import { listMenu } from "@/server/db/repositories/menu";
import { countOrders } from "@/server/db/repositories/orders";
import { expectedWait, loadNow } from "./wait";

export const getMenu = unstable_cache(async () => listMenu(await shopDb()), ["menu"], { revalidate: 300 });

export interface Pulse {
  date: ShopDate;
  /** the number the next simulated check on the rail will get */
  nextTicket: string;
  /** what a two-item order would wait right now, in seconds */
  waitForTwo: number;
  /** orders in the last hour over this hour's capacity */
  load: number;
}

export const getPulse = unstable_cache(
  async (): Promise<Pulse> => {
    const db = await shopDb();
    const now = new Date();
    const date = shopToday(now);
    const [placed, load] = await Promise.all([countOrders(db, date, now), loadNow(db, now)]);
    return { date, nextTicket: String(placed + 1).padStart(4, "0"), waitForTwo: expectedWait(2, load), load };
  },
  ["pulse"],
  { revalidate: 60 },
);
