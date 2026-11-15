import { asc, eq, sql } from "drizzle-orm";
import { MENU } from "./catalog";
import type { Db } from "@/server/platform/db/client";
import { menuItems } from "@/server/platform/db/schema";

/** Makes the menu table match the catalog (./catalog.ts). Safe to run on every deploy or cron. */
export async function syncMenu(db: Db): Promise<void> {
  await db
    .insert(menuItems)
    .values(MENU.map((m, sort) => ({ id: m.id, name: m.name, group: m.group, priceCents: m.priceCents, note: m.note ?? null, sort })))
    .onConflictDoUpdate({
      target: menuItems.id,
      set: {
        name: sql`excluded.name`,
        group: sql`excluded.group`,
        priceCents: sql`excluded.price_cents`,
        note: sql`excluded.note`,
        sort: sql`excluded.sort`,
        active: sql`true`,
      },
    });
}

export type MenuRow = typeof menuItems.$inferSelect;

/** What's on the board today, in board order. */
export async function listMenu(db: Db): Promise<MenuRow[]> {
  return db.select().from(menuItems).where(eq(menuItems.active, true)).orderBy(asc(menuItems.sort));
}
