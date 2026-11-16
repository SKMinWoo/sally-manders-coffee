import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFolder, contractions } from "./expand-only.mjs";

const why = (sql) => contractions(sql).map((c) => c.why);

test("every migration in drizzle/ only expands the schema, so a deploy never breaks the live code", () => {
  assert.deepEqual(checkFolder("drizzle"), []);
});

test("expanding passes: new tables (tightened as they are made), nullable columns, indexes, enum values", () => {
  const ok = [
    'CREATE TABLE "a" ("id" text PRIMARY KEY NOT NULL);--> statement-breakpoint\nALTER TABLE "a" ADD CONSTRAINT "a_fk" FOREIGN KEY ("id") REFERENCES "b"("id");',
    'ALTER TABLE "orders" ADD COLUMN "note" text;',
    'ALTER TABLE "orders" ADD COLUMN "rush" boolean DEFAULT false NOT NULL;',
    'CREATE INDEX "orders_note" ON "orders" USING btree ("note");',
    "ALTER TYPE \"public\".\"menu_group\" ADD VALUE 'tea';",
    'ALTER TABLE "orders" ADD CONSTRAINT "orders_note_short" CHECK (length("note") < 200) NOT VALID;',
  ];
  for (const sql of ok) assert.deepEqual(why(sql), [], sql);
});

test("contracting fails, each with what it would break", () => {
  const bad = {
    'DROP TABLE "briefs";': "drops what the live code may still read",
    'ALTER TABLE "orders" DROP COLUMN "visitor_hash";': "drops a column the live code may still read",
    'ALTER TABLE "orders" RENAME COLUMN "ticket" TO "number";': "renames what the live code still asks for by its old name",
    'ALTER TABLE "orders" ALTER COLUMN "ticket" SET DATA TYPE integer;': "changes a column's type under the live code",
    'ALTER TABLE "orders" ALTER COLUMN "visitor_hash" SET NOT NULL;': "makes a column required that the live code may leave empty",
    'ALTER TABLE "orders" ADD COLUMN "till" text NOT NULL;': "adds a required column the live code's inserts leave out",
    'ALTER TABLE "orders" ADD CONSTRAINT "orders_one_ticket" UNIQUE("ticket");': "adds a rule the live code's writes may break",
    'DELETE FROM "sim_days";': "deletes rows the live code may be reading",
  };
  for (const [sql, reason] of Object.entries(bad)) assert.deepEqual(why(sql), [reason], sql);
});

test("a contraction marked as shipped after the code stopped using it passes", () => {
  assert.deepEqual(why('-- contract-ok: nothing has read visitor_hash since #40\nALTER TABLE "orders" DROP COLUMN "visitor_hash";'), []);
  assert.equal(why('-- contract-ok:\nDROP TABLE "briefs";').length, 1, "a reason is required");
});
