import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "@/server/db/client";
import { testDb } from "@/server/db/test-db";
import { simulateDay } from "@/server/sim/day";
import { ensureDays } from "@/server/sim/run";
import { cronAuthorised } from "@/server/shop/cron";
import { openApiDocument } from "./openapi";
import { respond } from "./respond";
import { DayHours, DayItems, DaySummary, Health, Menu, Problem } from "./schemas";
import { day, dayHours, dayItems, health, menu } from "./v1";

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
    for (const bad of ["2026-02-30", "yesterday", "13-11-2026", "2026-11-13' or 1=1"]) {
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
  assert.deepEqual(Object.keys(doc.paths).sort(), ["/days/{date}", "/days/{date}/hours", "/days/{date}/items", "/health", "/menu"]);
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

test("the daily job only runs with the exact secret", () => {
  assert.equal(cronAuthorised("Bearer s3cret", "s3cret"), true);
  assert.equal(cronAuthorised("Bearer s3cre", "s3cret"), false);
  assert.equal(cronAuthorised("s3cret", "s3cret"), false);
  assert.equal(cronAuthorised(null, "s3cret"), false);
  assert.equal(cronAuthorised("Bearer ", ""), false, "no secret configured: nothing is authorised");
});
