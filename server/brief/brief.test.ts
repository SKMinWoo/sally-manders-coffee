import { after, test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import type { Db } from "@/server/platform/db/client";
import { testDb } from "@/server/platform/db/test-db";
import { ensureDays } from "@/server/simulator";
import { daySummary } from "@/server/reporting";
import { briefCounts, dayFigures, guard, latestBrief, parts, template, writeBrief } from ".";
import { endOf } from "./figures";

const DAY = "2026-11-12"; // a Thursday
const NOW = new Date("2026-11-13T15:00:00Z"); // the next morning in Austin, when the daily job runs
const KEYS = new Set(["orders", "takings", "weekday", "topItem"]);

const closers: (() => Promise<void>)[] = [];
after(() => Promise.all(closers.map((c) => c())));

/** A fresh database with the day and the same weekday before it written. */
async function shop(days = [addDays(DAY, -7), DAY]): Promise<Db> {
  const { db, close } = await testDb();
  closers.push(close);
  await ensureDays(db, days);
  return db;
}

/** A stand-in for Gemini that answers once with `body` and remembers what it was sent. */
function model(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}
const says = (...texts: string[]) => ({ candidates: [{ content: { parts: texts.map((text) => ({ text })) }, finishReason: "STOP" }] });
const noNetwork = (async () => {
  throw new Error("no request should have been made");
}) as typeof globalThis.fetch;

test("the guard keeps a draft whose every number is a {key}", () => {
  const v = guard("**{weekday}** was steady:\n{orders} orders, and no one waited long for the {topItem}.", KEYS);
  assert.deepEqual(v, { ok: true, body: "{weekday} was steady: {orders} orders, and no one waited long for the {topItem}." });
});

test("the guard turns back a number the writer wrote itself, in any form", () => {
  const cases: [string, RegExp][] = [
    ["{weekday} had 312 orders.", /“312”/],
    ["{orders} orders, up 5% on last week.", /“5%”/],
    ["Busiest at 7am, with {orders} orders.", /“7am,”/],
    ["{orders} orders, ½ of them lattes.", /“½”/],
    ["{orders} orders, ٣ of them cold.", /“٣”/], // an Arabic-Indic three
    ["{orders} orders: twice last week's.", /“twice”/],
    ["Twenty minutes was the worst wait on {weekday}.", /“Twenty”/],
    ["Half the {orders} orders were coffee.", /“Half”/],
  ];
  for (const [draft, reason] of cases) {
    const v = guard(draft, KEYS);
    assert.equal(v.ok, false, draft);
    assert.match((v as { reason: string }).reason, reason, draft);
  }
});

test("the guard turns back a key that isn't the day's, a stray brace, no figures at all, and a ramble", () => {
  const reason = (d: string) => (guard(d, KEYS) as { ok: false; reason: string }).reason;
  assert.match(reason("{orders} orders and {profit} profit."), /\{profit\}, which isn't one of the day's figures/);
  assert.match(reason("{orders} orders {and a brace."), /brace/);
  assert.match(reason("A lovely day at the shop."), /none of the day's figures/);
  assert.match(reason(`{orders} orders. ${"It was a very good day. ".repeat(40)}`), /length of a note/);
  assert.match(reason("   "), /empty/);
});

test("a kept brief splits into words and figures, so each figure can link to its source", () => {
  const figures = [{ key: "orders", display: "223" }];
  assert.deepEqual(parts("{orders} orders, {orders} again.", figures), [figures[0], " orders, ", figures[0], " again."]);
});

test("the day's figures are the whole day's, labelled with where each comes from", async () => {
  const db = await shop();
  const figures = await dayFigures(db, DAY);
  const by = new Map(figures.map((f) => [f.key, f]));
  const d = await daySummary(db, DAY, endOf(DAY));
  const w = await daySummary(db, addDays(DAY, -7), endOf(addDays(DAY, -7)));
  assert.equal(by.get("weekday")?.display, "Thursday");
  assert.equal(by.get("orders")?.display, d.orders.toLocaleString("en-US"));
  assert.equal(by.get("takings")?.display, formatMoney(d.salesCents, { whole: true }));
  const pct = Math.round(((d.orders - w.orders) / w.orders) * 100);
  assert.equal(by.get("ordersChange")?.display, pct === 0 ? "level" : pct > 0 ? `up ${pct}%` : `down ${-pct}%`);
  assert.equal(by.get("orders")?.source, `/api/v1/days/${DAY}`);
  assert.equal(by.get("ordersChange")?.source, `/api/v1/days/${addDays(DAY, -7)}`);
  assert.equal(by.get("busiestHour")?.source, `/api/v1/days/${DAY}/hours`);
  assert.match(by.get("busiestHour")!.display, /^\d{1,2} (am|pm)$/);

  const alone = await dayFigures(await shop([DAY]), DAY);
  assert.ok(!alone.some((f) => f.key.endsWith("Change")), "with no week before, there's no change to state");
  for (const fs of [figures, alone]) assert.equal(guard(template(fs), new Set(fs.map((f) => f.key))).ok, true, "the template keeps the guard's rule");
});

test("with no model key, yesterday's brief is the template's, and nothing is sent anywhere", async () => {
  const db = await shop();
  const r = await writeBrief(db, NOW, { fetch: noNetwork });
  assert.deepEqual(r, { day: DAY, written: true, writer: "template", refused: null, guarded: false });
  const b = (await latestBrief(db))!;
  assert.equal(b.day, DAY);
  assert.match(b.body, /^\{weekday\} came to \{orders\} orders/);
  assert.ok(b.figures.some((f) => f.key === "orders"));
  assert.deepEqual(await writeBrief(db, NOW, { fetch: noNetwork }), { day: DAY, written: false }, "a second run leaves the day alone");
});

test("a model's draft that keeps the rule is the brief; the key goes in a header, never the URL", async () => {
  const db = await shop();
  const draft = "{weekday} was a steady one: {orders} orders and {takings} through the till. Keep the {topItem} coming.";
  const m = model(200, says(draft));
  const r = await writeBrief(db, NOW, { key: "test-key", fetch: m.fetch });
  assert.deepEqual(r, { day: DAY, written: true, writer: "gemini-flash-latest", refused: null, guarded: false });
  assert.equal(m.calls.length, 1);
  assert.equal(m.calls[0]!.url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent");
  assert.equal(new Headers(m.calls[0]!.init.headers).get("x-goog-api-key"), "test-key");
  const sent = JSON.parse(String(m.calls[0]!.init.body));
  assert.match(sent.contents[0].parts[0].text, /\{orders\}: Orders over the whole day \(\d[\d,]*\)/, "the figures go to the model with their keys");
  assert.equal((await latestBrief(db))!.body, draft);
});

test("a draft that writes a number itself is turned back, and the template is stored with the reason", async () => {
  const db = await shop();
  const m = model(200, says("{weekday} brought {orders} orders, about 40 more than usual."));
  const r = await writeBrief(db, NOW, { key: "test-key", fetch: m.fetch });
  assert.equal(r.written && r.writer, "template");
  assert.equal(r.written && r.guarded, true);
  assert.match((r.written && r.refused) || "", /it wrote “40” itself/);
  assert.match((await latestBrief(db))!.body, /^\{weekday\} came to/);
});

test("a model that can't answer leaves the template, and says why, without blaming the guard", async () => {
  const quota = await writeBrief(await shop(), NOW, { key: "k", fetch: model(429, { error: { code: 429 } }).fetch });
  assert.deepEqual(quota.written && [quota.writer, quota.refused, quota.guarded], ["template", "the model's free quota was spent", false]);

  const thinking = model(200, { candidates: [{ content: { parts: [{ text: "Let me count 312…", thought: true }, { text: "{orders} orders on {weekday}." }] } }] });
  const t = await writeBrief(await shop(), NOW, { key: "k", fetch: thinking.fetch });
  assert.equal(t.written && t.writer, "gemini-flash-latest", "a thinking model's reasoning isn't the draft");

  const odd = await writeBrief(await shop(), NOW, { key: "k", model: "../../evil?x=", fetch: noNetwork });
  assert.equal(odd.written && odd.refused, "GEMINI_MODEL isn't a model name");
});

test("the counts the back office shows: written, kept from a model, and turned back by the guard", async () => {
  const db = await shop([addDays(DAY, -9), addDays(DAY, -8), addDays(DAY, -7), DAY]);
  await writeBrief(db, new Date("2026-11-04T15:00:00Z"), { fetch: noNetwork }); // the 3rd: template, no key
  await writeBrief(db, new Date("2026-11-05T15:00:00Z"), { key: "k", fetch: model(200, says("{orders} orders, 9 of them late.")).fetch });
  await writeBrief(db, NOW, { key: "k", fetch: model(200, says("{orders} orders on {weekday}.")).fetch });
  assert.deepEqual(await briefCounts(db), { written: 3, byModel: 1, refused: 1, guarded: 1 });
});
