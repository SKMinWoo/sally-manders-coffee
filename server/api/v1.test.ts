import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "@/server/platform/db/client";
import { testDb } from "@/server/platform/db/test-db";
import { simulateDay } from "@/server/simulator";
import { ensureDays } from "@/server/simulator";
import { cronAuthorised } from "@/server/platform/auth";
import { openApiDocument } from "./openapi";
import { respond } from "../platform/http";
import { writeBrief } from "@/server/brief";
import { Brief, DayHours, DayItems, DaySummary, Footfall, Health, Menu, Problem } from "./schemas";
import { brief, day, dayHours, dayItems, footfall, health, menu } from "./v1";

let db: Db, close: () => Promise<void>;
before(async () => ({ db, close } = await testDb()));
after(() => close());

const NOON = new Date("2026-11-13T18:00:00Z"); // noon in Austin on Fri 13 Nov
const sim = simulateDay("2026-11-13");

test("health is degraded until the simulator has written today and tomorrow, then ok", async () => {
  const before = await health(db, NOON);
  assert.equal(Health.parse(before.body).status, "degraded");
  await ensureDays(db, ["2026-11-13", "2026-11-14"]);
  const r = await health(db, NOON);
  assert.deepEqual(Health.parse(r.body), { status: "ok", time: NOON.toISOString(), today: "2026-11-13", simulatorAhead: true });
  assert.equal(r.cache, "none", "health is never cached");
});

test("the menu matches its contract, in board order", async () => {
  const r = await menu(db);
  const items = Menu.parse(r.body).items;
  assert.equal(items[0]!.id, "espresso");
  assert.equal(r.cache, "public");
});

test("footfall: the last quarter hour by default, since is clamped to it, and a bad since is a 400", async () => {
  const quarter = new Date(+NOON - 15 * 60_000);
  const r = await footfall(db, null, NOON);
  const all = Footfall.parse(r.body);
  assert.equal(r.cache, "none");
  assert.equal(all.since, quarter.toISOString());
  assert.equal(all.guests.length, sim.orders.filter((o) => o.placedAt > quarter && o.placedAt <= NOON).length);
  assert.deepEqual(Footfall.parse((await footfall(db, "2020-01-01T00:00:00Z", NOON)).body), all, "no further back than 15 minutes");

  const mid = all.guests[Math.floor(all.guests.length / 2)]!.placedAt;
  const newer = Footfall.parse((await footfall(db, mid, NOON)).body).guests;
  assert.deepEqual(newer, all.guests.filter((g) => g.placedAt > mid), "only what came after since");
  assert.equal(Footfall.parse((await footfall(db, "2030-01-01T00:00:00Z", NOON)).body).guests.length, 0, "a future since is now");
  assert.equal((await footfall(db, "noon-ish", NOON)).status, 400);
});

test("a day so far: today and its date give the same answer, and later orders don't count", async () => {
  const a = DaySummary.parse((await day(db, "today", NOON)).body);
  const b = DaySummary.parse((await day(db, "2026-11-13", NOON)).body);
  assert.deepEqual(a, b);
  const sofar = sim.orders.filter((o) => o.placedAt <= NOON);
  assert.equal(a.orders, sofar.length);
  assert.equal(a.salesCents, sofar.reduce((n, o) => n + o.subtotalCents, 0));
  assert.equal(a.averageCheckCents, Math.round(a.salesCents / a.orders));
  // percentile_cont interpolates (production showed 299.59999999999997); the API sends whole seconds
  assert.ok(Number.isInteger(a.waitP50Seconds) && Number.isInteger(a.waitP95Seconds));

  const hours = DayHours.parse((await dayHours(db, "today", NOON)).body).hours;
  assert.equal(hours.reduce((n, h) => n + h.orders, 0), a.orders);
  const items = DayItems.parse((await dayItems(db, "today", NOON)).body).items;
  assert.equal(items.reduce((n, i) => n + i.salesCents, 0), a.salesCents);
});

test("tomorrow is a 404 even though its orders are already written; a bad date is a 400", async () => {
  for (const handler of [day, dayHours, dayItems]) {
    const future = await handler(db, "2026-11-14", NOON);
    assert.equal(future.status, 404);
    assert.equal(Problem.parse(future.body).status, 404);
    for (const bad of ["2026-02-30", "2026-13-01", "yesterday", "13-11-2026", "2026-11-13' or 1=1"]) {
      assert.equal((await handler(db, bad, NOON)).status, 400, bad);
    }
  }
});

test("responses carry the cache policy, and errors are problem+json", async () => {
  const okRes = respond(await day(db, "today", NOON));
  assert.equal(okRes.headers.get("cache-control"), "public, s-maxage=60, stale-while-revalidate=300");
  assert.equal(okRes.headers.get("content-type"), "application/json");
  const bad = respond(await day(db, "nope", NOON));
  assert.equal(bad.status, 400);
  assert.equal(bad.headers.get("content-type"), "application/problem+json");
  assert.equal(bad.headers.get("cache-control"), "no-store");
});

test("the OpenAPI document covers every endpoint, and every $ref resolves", () => {
  const doc = openApiDocument();
  assert.deepEqual(Object.keys(doc.paths).sort(), ["/board", "/brief", "/days/{date}", "/days/{date}/hours", "/days/{date}/items", "/engineering", "/exports/sales", "/footfall", "/health", "/menu"]);
  // collect every $ref, not only the well-formed ones, so a malformed ref fails instead of being skipped
  const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"([^"]*)"/g)].map((m) => m[1]!);
  assert.ok(refs.length > 0);
  for (const r of refs) {
    const name = /^#\/components\/schemas\/(\w+)$/.exec(r)?.[1];
    assert.ok(name && name in doc.components.schemas, `unresolved $ref ${r}`);
  }
  assert.ok(!("__shared" in doc.components.schemas), "a schema with an id is missing from SCHEMAS");
  for (const s of Object.values(doc.components.schemas)) assert.ok(!("$schema" in s) && !("$id" in s));
  const summary = doc.components.schemas.DaySummary as { required: string[] };
  assert.ok(summary.required.includes("waitP95Seconds"));
});

test("the brief is a 404 until one is written, then the note with every figure filled in from its source", async () => {
  const none = await brief(db);
  assert.equal(none.status, 404);
  Problem.parse(none.body);

  await writeBrief(db, new Date("2026-11-14T15:00:00Z")); // the morning after the 13th, with no model key
  const r = await brief(db);
  const b = Brief.parse(r.body);
  assert.equal(b.date, "2026-11-13");
  assert.equal(b.writer, "template");
  assert.doesNotMatch(b.text, /[{}]/, "every {key} is filled in");
  const used = [...b.template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
  for (const key of used) {
    const f = b.figures.find((x) => x.key === key)!;
    assert.ok(b.text.includes(f.display), `${key} is shown as ${f.display}`);
  }
  const orders = b.figures.find((f) => f.key === "orders")!;
  assert.equal(orders.display, sim.orders.length.toLocaleString("en-US"), "the figure is the whole day's, from the database");
  assert.equal(r.cache, "public");
});

test("the daily job only runs with the exact secret", () => {
  assert.equal(cronAuthorised("Bearer s3cret", "s3cret"), true);
  assert.equal(cronAuthorised("Bearer s3cre", "s3cret"), false);
  assert.equal(cronAuthorised("s3cret", "s3cret"), false);
  assert.equal(cronAuthorised(null, "s3cret"), false);
  assert.equal(cronAuthorised("Bearer ", ""), false, "no secret configured: nothing is authorised");
});
