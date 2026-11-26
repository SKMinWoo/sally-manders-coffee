import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import type { Db } from "@/server/platform/db/client";
import { saleLines, spanStats } from "../sales";
import { orders } from "@/server/platform/db/schema";
import { testDb } from "@/server/platform/db/test-db";
import { ensureDays } from "@/server/simulator";
import { checkSalesWorkbook, readWorkbook, unzip } from "./check";
import { isNothingNew, marksIn, tagFor } from "./nothing-new";
import { exportSales, MAX_DAYS } from "./sales";
import { workbook } from "./xlsx";

let db: Db, close: () => Promise<void>;
before(async () => {
  ({ db, close } = await testDb());
  await ensureDays(db, ["2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]);
});
after(() => close());

const NOON = new Date("2026-11-13T18:00:00Z"); // noon in Austin, Fri 13 Nov
const all = async (g: AsyncIterable<Uint8Array>) => {
  const parts: Uint8Array[] = [];
  for await (const p of g) parts.push(p);
  return Buffer.concat(parts);
};
const q = (from: string | null, to: string | null, ifNoneMatch: string | null = null) => ({ from, to, ifNoneMatch });

test("a workbook round-trips: text escaped, control characters dropped, numbers and money kept", async () => {
  const buf = await all(workbook([
    { name: "One", columns: [{ header: "A & B", width: 9 }, { header: "N", width: 5 }], rows: [["<tag> \"q\" \u0007bell", 42], ["", { cents: 1999 }]] },
    { name: "Two", columns: [{ header: "X", width: 5 }], rows: [] },
  ]));
  const book = readWorkbook(buf);
  assert.deepEqual(book.get("One"), [["A & B", "N"], ['<tag> "q" bell', 42], ["", 19.99]]);
  assert.deepEqual(book.get("Two"), [["X"]]);
  for (const part of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", "xl/worksheets/sheet2.xml"]) assert.ok(unzip(buf).has(part), part);
  assert.throws(() => workbook([{ name: "a/b", columns: [], rows: [] }]), /sheet name/);
});

test("a damaged workbook is caught by its CRC, not opened", async () => {
  const buf = await all(workbook([{ name: "S", columns: [{ header: "h", width: 5 }], rows: Array.from({ length: 200 }, (_, i) => [`row ${i}`]) }]));
  const bad = Buffer.from(buf);
  const sheetAt = bad.indexOf("xl/worksheets/sheet1.xml") + 40;
  bad[sheetAt] = bad[sheetAt]! ^ 0xff;
  assert.throws(() => unzip(bad));
});

test("the sales export: every line so far, and its rows add up to its own totals", async () => {
  const r = await exportSales(db, q("2026-11-11", "2026-11-13"), NOON);
  assert.equal(r.kind, "workbook");
  if (r.kind !== "workbook") return;
  const check = checkSalesWorkbook(await all(r.body()));
  assert.deepEqual(check.problems, []);
  assert.equal(check.rows, r.stats.lines);
  assert.ok(r.stats.lines > 500, `three days of lines, got ${r.stats.lines}`);
  assert.equal(r.filename, "sally-manders-sales-2026-11-11-to-2026-11-13.xlsx");
  // orders written ahead for this afternoon and tomorrow are not in it
  const later = await spanStats(db, { from: "2026-11-11", to: "2026-11-13" }, new Date("2026-11-14T05:59:00Z"));
  assert.ok(later.lines > r.stats.lines);
});

test("paging by key gives the same lines as one big page, in order, none twice", async () => {
  const span = { from: "2026-11-12", to: "2026-11-12" };
  const keys = async (page: number) => { const k: string[] = []; for await (const l of saleLines(db, span, NOON, page)) k.push(`${l.orderId}/${l.itemId}`); return k; };
  const small = await keys(97), big = await keys(100_000);
  assert.deepEqual(small, big);
  assert.equal(new Set(small).size, small.length);
});

test("a span is refused before anything is read: not a date, backwards, not yet, too long", async () => {
  for (const [from, to, title] of [
    ["2026-13-01", "2026-11-13", "Not a date"],
    ["2026-11-13", "2026-11-11", "The span runs backwards"],
    ["2026-11-13", "2026-11-14", "That day hasn't happened yet"],
    ["2026-08-01", "2026-11-13", "Too long a span"],
  ] as const) {
    const r = await exportSales(db, q(from, to), NOON);
    assert.equal(r.kind === "problem" && r.status, 400, title);
    assert.equal(r.kind === "problem" && r.title, title);
  }
  assert.ok(MAX_DAYS >= 28);
  const dflt = await exportSales(db, q(null, null), NOON);
  assert.equal(dflt.kind === "workbook" && dflt.filename, "sally-manders-sales-2026-10-17-to-2026-11-13.xlsx", "the last 28 days by default");
});

test("a span whose checks don't add up is refused whole, with nothing exported", async () => {
  const [o] = await db.select({ id: orders.id }).from(orders).where(eq(orders.day, "2026-11-11")).limit(1);
  await db.update(orders).set({ subtotalCents: sql`${orders.subtotalCents} + 1` }).where(eq(orders.id, o!.id));
  try {
    const r = await exportSales(db, q("2026-11-11", "2026-11-11"), NOON);
    assert.equal(r.kind === "problem" && r.status, 409);
    assert.match(r.kind === "problem" ? r.detail : "", /^1 order/);
  } finally {
    await db.update(orders).set({ subtotalCents: sql`${orders.subtotalCents} - 1` }).where(eq(orders.id, o!.id));
  }
});

test("no-op detection: the tag carries the span's mark, and only a matching span is compared", async () => {
  const first = await exportSales(db, q("2026-11-12", "2026-11-12"), NOON);
  assert.equal(first.kind, "workbook");
  const seen: unknown[] = [];
  const always = (before: unknown) => (seen.push(before), true);
  const again = await exportSales(db, q("2026-11-12", "2026-11-12", `W/"other", ${first.kind === "workbook" ? first.tag : ""}`), NOON, always);
  assert.equal(again.kind, "unchanged");
  assert.equal(seen.length, 1);
  // a tag for a different span, or one that isn't ours, is never compared
  const other = await exportSales(db, q("2026-11-11", "2026-11-12", first.kind === "workbook" ? first.tag : ""), NOON, always);
  assert.equal(other.kind, "workbook");
  assert.deepEqual(marksIn('"sales-v1.not-base64-json", "abc", *'), []);
  const m = { from: "2026-11-12", to: "2026-11-12", orders: 3, lines: 5, lastOrderId: 9, lineTotalCents: 1234 };
  assert.deepEqual(marksIn(tagFor(m)), [m]);
});

test("no-op detection: a repeat with the same rows is answered 'Nothing changed', and any new order builds afresh", async () => {
  const first = await exportSales(db, q("2026-11-12", "2026-11-12"), NOON);
  assert.equal(first.kind, "workbook");
  const tag = first.kind === "workbook" ? first.tag : "";
  // the default rule: the same span, read again at the same moment, holds the same rows
  const again = await exportSales(db, q("2026-11-12", "2026-11-12", tag), NOON);
  assert.equal(again.kind, "unchanged");
  // any one figure moving means the visitor's copy is out of date
  const [m] = marksIn(tag);
  for (const k of ["orders", "lines", "lastOrderId", "lineTotalCents"] as const) {
    assert.equal(isNothingNew(m!, { ...m!, [k]: m![k] + 1 }), false, k);
  }
  assert.equal(isNothingNew(m!, { ...m!, to: "2026-11-13" }), false, "another span");
  assert.equal(isNothingNew(m!, { ...m! }), true);
});
