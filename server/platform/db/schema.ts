import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
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
 * server/orders, never directly.
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
  /**
   * Visitor orders only: an HMAC of the visitor's IP under a server-side salt, for rate limiting.
   * The IP itself is never stored, and without the salt the hash can't be walked back to one.
   */
  visitorHash: text(),
}, (t) => [
  unique("orders_day_ticket").on(t.day, t.ticket),
  index("orders_day_placed").on(t.day, t.placedAt),
  index("orders_visitor_placed").on(t.visitorHash, t.placedAt).where(sql`${t.visitorHash} is not null`),
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
  /**
   * The levers the day was simulated with (server/simulator/levers.ts), sorted; null for a day
   * simulated the original way, before the board, or with none in effect.
   */
  levers: jsonb().$type<string[]>(),
  writtenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/**
 * Figures measured by CI runs on main (test counts, coverage, gate results, P95s): one row per
 * kind per run, posted to /api/ingest/ci. Every figure the back office shows from here links to
 * the run that measured it, so nothing on that page is typed in by hand.
 */
export const engineeringFacts = pgTable("engineering_facts", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  kind: text().notNull(),
  /** the measured figures, in the shape server/office/facts.ts gives this kind */
  value: jsonb().notNull(),
  /** the GitHub Actions run, so a retried post of the same run is stored once */
  runId: bigint({ mode: "number" }).notNull(),
  runUrl: text().notNull(),
  sha: text().notNull(),
  recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("facts_kind_run").on(t.kind, t.runId),
  index("facts_kind_recorded").on(t.kind, t.recordedAt),
  check("facts_sha_hex", sql`${t.sha} ~ '^[0-9a-f]{40}$'`),
]);

/**
 * The manager's brief (server/brief): one note per complete Austin day. The body holds {key}
 * where each figure goes and the figures are stored beside it, so a figure in a brief is always
 * the database's, never the writer's, and a brief reads the same however the data changes later.
 */
export const briefs = pgTable("briefs", {
  day: date({ mode: "string" }).primaryKey(),
  body: text().notNull(),
  /** each figure the body may use: key, label, display and the API path it comes from */
  figures: jsonb().notNull(),
  /** the model that wrote the body, or "template" when none did */
  writer: text().notNull(),
  /** why the model's draft wasn't kept, when it wasn't; the template was used instead */
  refused: text(),
  /** true when it was the guard that turned the draft back (it wrote a number), not the model failing to answer */
  guarded: boolean().notNull().default(false),
  writtenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [check("briefs_writer_named", sql`length(${t.writer}) > 0`)]);

export const callKind = pgEnum("call_kind", ["customer", "manager"]);

/**
 * The morning calls (server/board): a regular on yesterday, then the manager's reply, one of each
 * per Austin day. Like a brief, the body holds {key} where each figure goes, stored beside it.
 */
export const calls = pgTable("calls", {
  day: date({ mode: "string" }).notNull(),
  kind: callKind().notNull(),
  /** who spoke: the regular's id, or "manager" */
  speaker: text().notNull(),
  body: text().notNull(),
  figures: jsonb().notNull(),
  /** what came with it: the regular's topic and mood, the manager's decision and the reason a decision was turned down */
  payload: jsonb().notNull(),
  writer: text().notNull(),
  refused: text(),
  guarded: boolean().notNull().default(false),
  writtenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.day, t.kind] }), check("calls_writer_named", sql`length(${t.writer}) > 0`)]);

export const experimentStatus = pgEnum("experiment_status", ["live", "measured"]);
export const experimentVerdict = pgEnum("experiment_verdict", ["kept", "rolled-back"]);

/**
 * The work: each change the manager tried, one at a time. It runs from startsOn for a week (to
 * endsOn), then code measures it against the same week replayed without it and keeps it or takes
 * it back. `until` is the last day a rolled-back change was still in, since a day or two are
 * always written ahead of the verdict.
 */
export const experiments = pgTable("experiments", {
  id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  lever: text().notNull(),
  /** the regular's topic the manager was answering */
  heard: text().notNull(),
  proposedOn: date({ mode: "string" }).notNull(),
  startsOn: date({ mode: "string" }).notNull(),
  endsOn: date({ mode: "string" }).notNull(),
  status: experimentStatus().notNull().default("live"),
  verdict: experimentVerdict(),
  until: date({ mode: "string" }),
  /** the measured effect, in the shape server/board/measure.ts gives it */
  effect: jsonb(),
  measuredOn: date({ mode: "string" }),
}, (t) => [
  // one change at a time: at most one row can be live
  uniqueIndex("experiments_one_live").on(t.status).where(sql`${t.status} = 'live'`),
  index("experiments_lever").on(t.lever),
  check("experiments_week", sql`${t.endsOn} >= ${t.startsOn}`),
  check("experiments_measured", sql`(${t.status} = 'live') = (${t.verdict} is null)`),
]);
