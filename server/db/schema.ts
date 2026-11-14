import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const menuGroup = pgEnum("menu_group", ["bar", "brewed", "not-coffee", "food"]);
export const orderSource = pgEnum("order_source", ["sim", "visitor"]);

export const menuItems = pgTable("menu_items", {
  id: text().primaryKey(),
  name: text().notNull(),
  group: menuGroup().notNull(),
  priceCents: integer().notNull(),
  note: text(),
  sort: integer().notNull(),
  active: boolean().notNull().default(true),
}, (t) => [check("menu_price_positive", sql`${t.priceCents} > 0`)]);

/**
 * Every order, simulated or real. Simulated days are written ahead (docs/decisions/0002), so
 * this table holds orders that have not "happened" yet: read it through `placedBy()` in
 * repositories/orders.ts, never directly.
 */
export const orders = pgTable("orders", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  publicId: text().notNull().unique(),
  /** the Austin calendar day it was placed on */
  day: date({ mode: "string" }).notNull(),
  /** "0042" for the simulator's tickets, "A-07" for a visitor's order-ahead */
  ticket: text().notNull(),
  source: orderSource().notNull(),
  placedAt: timestamp({ withTimezone: true }).notNull(),
  readyAt: timestamp({ withTimezone: true }).notNull(),
  subtotalCents: integer().notNull(),
  taxCents: integer().notNull(),
}, (t) => [
  unique("orders_day_ticket").on(t.day, t.ticket),
  index("orders_day_placed").on(t.day, t.placedAt),
  check("orders_ready_after_placed", sql`${t.readyAt} > ${t.placedAt}`),
  check("orders_money_whole", sql`${t.subtotalCents} > 0 and ${t.taxCents} >= 0`),
]);

export const orderLines = pgTable("order_lines", {
  orderId: bigint({ mode: "number" }).notNull().references(() => orders.id, { onDelete: "cascade" }),
  itemId: text().notNull().references(() => menuItems.id),
  qty: integer().notNull(),
  /** the price when it was ordered, so a later menu change does not rewrite history */
  priceCents: integer().notNull(),
}, (t) => [
  primaryKey({ columns: [t.orderId, t.itemId] }),
  check("lines_qty_positive", sql`${t.qty} > 0`),
]);

/** A simulated day is marked written only after all of its orders are in. */
export const simDays = pgTable("sim_days", {
  day: date({ mode: "string" }).primaryKey(),
  seed: bigint({ mode: "number" }).notNull(),
  orders: integer().notNull(),
  writtenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
