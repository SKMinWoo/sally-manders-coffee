import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { addDays } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { testDb } from "@/server/platform/db/test-db";
import { guard } from "@/server/brief";
import { leversOn, LEVER_IDS, TOPICS, type Topic } from "@/server/simulator";
import { board } from "@/server/api/v1";
import { Board as BoardSchema } from "@/server/api/schemas";
import { boardView, lineOf, rehearse, REGULARS, runStandup } from "@/server/board";
import { templateCustomer, speakAsRegular } from "./customer";
import { decide, pick, templateManager, type Situation } from "./manager";
import { inEffect, unavailable } from "./plan";
import { allExperiments, callsSince, type Experiment } from "./repository";
import { shouldKeep, type Deltas } from "./verdict";

const NOW = new Date("2026-11-22T18:00:00Z"); // noon in Austin, Sun 22 Nov
let db: Db, close: () => Promise<void>;
before(async () => {
  ({ db, close } = await testDb());
  assert.equal(await rehearse(db, NOW), true);
});
after(() => close());

/** A model that answers with `text`, or with an HTTP status. */
const model = (reply: string | number): typeof fetch =>
  (async () =>
    typeof reply === "number" ? new Response("", { status: reply }) : Response.json({ candidates: [{ content: { parts: [{ text: reply }] } }] })) as typeof fetch;

test("a fortnight of mornings: a change measured and kept, the next being tried, a call each morning", async () => {
  const b = await boardView(db, NOW);
  assert.equal(b.measured.length, 1);
  assert.equal(b.measured[0]!.lever, "rushBarista");
  assert.equal(b.measured[0]!.verdict, "kept", "the third barista cut the morning wait by about a fifth and moved nothing else");
  assert.ok(b.trying, "a second change is being tried");
  assert.deepEqual(b.standing.map((s) => s.lever), ["rushBarista"]);
  assert.deepEqual(lineOf(b), { kind: "trying", name: b.trying!.name, day: b.trying!.day!, of: 7 });

  const calls = await callsSince(db, "2026-01-01");
  assert.equal(calls.length, 2 * 15, "a customer and a manager call each morning, the first one included");
  for (const c of calls) {
    assert.ok(guard(c.body, new Set(c.figures.map((f) => f.key))).ok, `${c.day} ${c.kind} passes the guard`);
    for (const f of c.figures) assert.ok(f.source.startsWith("/api/v1/"), `${f.key} names its source`);
  }
});

test("the board says when the next choice is made and what's free then, and why each morning held", async () => {
  const b = await boardView(db, NOW);
  const trying = b.trying!;
  const kept = b.measured[0]!;
  assert.equal(b.next?.on, addDays(trying.endsOn, 1), "the morning after its last day measures it, and the manager may choose again");
  assert.deepEqual(
    b.next!.open.map((o) => o.lever),
    LEVER_IDS.filter((id) => id !== trying.lever && id !== kept.lever),
    "neither the change on trial nor the one kept is on the list",
  );

  assert.equal(b.standing[0]!.proposedOn, kept.proposedOn);
  assert.equal(b.standing[0]!.heard, kept.heard, "a kept change says what the regular had raised the morning it was chosen");
  assert.ok(b.standing[0]!.deltas, "and what its week showed");

  const mornings = [b.latest!, ...b.log];
  const chose = mornings.filter((m) => m.chose).map((m) => m.day).sort();
  assert.deepEqual(chose, [kept.proposedOn, trying.proposedOn], "the two mornings that chose a change say so");
  for (const m of mornings.filter((m) => !m.chose)) {
    const running = [kept, trying].find((e) => e.proposedOn < m.day && m.day <= e.endsOn);
    assert.equal(m.heldFor, running?.name ?? null, `${m.day}: held for the change still running, if one was`);
  }
});

test("the days the change ran were written with it, and the measurement compares the same guests", async () => {
  const [kept] = await allExperiments(db);
  assert.deepEqual(await leversOn(db, kept!.startsOn), ["rushBarista"]);
  assert.deepEqual(await leversOn(db, kept!.proposedOn), [], "the day it was chosen was already written");
  const e = kept!.effect!;
  assert.equal(e.days, 7);
  assert.equal(e.with.orders, e.without.orders, "a barista doesn't bring anyone in");
  assert.ok(e.with.hoursWaitP50! < e.without.hoursWaitP50!);
  assert.equal(e.with.staffHours - e.without.staffHours, 7 * 3);
});

test("a second run of the morning's standup changes nothing", async () => {
  const before = { calls: (await callsSince(db, "2026-01-01")).length, experiments: await allExperiments(db) };
  const r = await runStandup(db, new Date("2026-11-22T08:30:00Z"));
  assert.equal(r.manager.written, false);
  assert.equal((await callsSince(db, "2026-01-01")).length, before.calls);
  assert.deepEqual(await allExperiments(db), before.experiments);
});

test("the API's board keeps its contract", async () => {
  const r = await board(db, NOW);
  const b = BoardSchema.parse(r.body);
  assert.ok(b.latest?.customer?.text && !b.latest.customer.text.includes("{"), "figures filled in");
  assert.equal(b.counts.tried, 2);
});

const exp = (over: Partial<Experiment>): Experiment => ({
  id: 1, lever: "prepAhead", heard: "wait", proposedOn: "2026-11-01", startsOn: "2026-11-02", endsOn: "2026-11-08",
  status: "measured", verdict: "rolled-back", until: "2026-11-09", effect: null, measuredOn: "2026-11-09", ...over,
});

test("the repository's refusals: one at a time, nothing kept twice, a fortnight's rest after a rollback", () => {
  assert.match(unavailable([exp({ status: "live", verdict: null })], "pickupShelf", "2026-11-05")!, /one at a time/);
  assert.match(unavailable([exp({ verdict: "kept" })], "prepAhead", "2026-12-30")!, /already part of the shop/);
  assert.match(unavailable([exp({})], "prepAhead", "2026-11-22")!, /fortnight/);
  assert.equal(unavailable([exp({})], "prepAhead", "2026-11-23"), null, "fourteen days on, it may be tried again");
  assert.equal(unavailable([exp({})], "pickupShelf", "2026-11-10"), null);
});

test("a rolled-back change stays in the days already written, and is out after", () => {
  const e = exp({});
  assert.equal(inEffect(e, "2026-11-01"), false);
  assert.equal(inEffect(e, "2026-11-09"), true);
  assert.equal(inEffect(e, "2026-11-10"), false);
  assert.equal(inEffect(exp({ verdict: "kept" }), "2027-06-01"), true);
});

const situation = (over: Partial<Situation> = {}): Situation => ({
  heardText: "It was fine.", regularName: "Mateo", topic: "wait", mood: "mixed", heardLately: [{ topic: "line", times: 3 }],
  live: null, measured: null, unavailable: {}, startsOn: "2026-11-24",
  figures: [{ key: "orders", label: "Orders", display: "300", source: "/api/v1/days/2026-11-22" }, { key: "takings", label: "Takings", display: "$2,000", source: "/api/v1/days/2026-11-22" }, { key: "weekday", label: "Day", display: "Sunday", source: "/api/v1/days/2026-11-22" }],
  ...over,
});
const cfg = (reply: string | number) => ({ key: "test-key", fetch: model(reply) });

test("the template manager answers what was raised, then what's been heard most, and holds when nothing is free", () => {
  assert.equal(pick(situation()), "prepAhead", "the wait was raised this morning");
  assert.equal(pick(situation({ unavailable: { prepAhead: "x", pickupShelf: "x" } })), "rushBarista", "then the line, heard most");
  assert.equal(pick(situation({ live: "pickupShelf" })), null);
  assert.equal(pick(situation({ unavailable: Object.fromEntries(LEVER_IDS.map((id) => [id, "x"])) })), null);
});

test("the manager may propose; the repository decides", async () => {
  const ok = await decide(situation(), cfg(JSON.stringify({ note: "We'll try {chosen} from {startsOn}; {weekday} saw {orders} orders.", decision: "pickupShelf" })));
  assert.equal(ok.payload.decision, "pickupShelf");
  assert.equal(ok.writer, "gemini-flash-lite-latest");

  const made = await decide(situation(), cfg(JSON.stringify({ note: "Free lattes from {startsOn}! {orders} orders.", decision: "freeLattes" })));
  assert.equal(made.payload.decision, null, "not a lever: hold");
  assert.equal(made.payload.declined?.asked, "freeLattes");

  const resting = await decide(situation({ unavailable: { pickupShelf: "it was taken back less than a fortnight ago" } }), cfg(JSON.stringify({ note: "{orders} orders.", decision: "pickupShelf" })));
  assert.equal(resting.payload.decision, null);
  assert.match(resting.payload.declined!.reason, /fortnight/);

  const counted = await decide(situation(), cfg(JSON.stringify({ note: "We had 300 orders, so {chosen} from {startsOn}.", decision: "pickupShelf" })));
  assert.equal(counted.payload.decision, "pickupShelf", "a note the guard turns back doesn't undo a valid decision");
  assert.equal(counted.writer, "template");
  assert.equal(counted.guarded, true);

  for (const [reply, why] of [[429, /quota/], ["not json", /JSON/], [JSON.stringify({ note: 4 }), /JSON/]] as const) {
    const d = await decide(situation(), cfg(reply));
    assert.match(d.refused!, why);
    assert.equal(d.payload.decision, "prepAhead", "the template's choice");
    assert.equal(d.payload.decidedBy, "template");
  }
});

test("every template note passes the guard: each regular, each topic, each mood, with and without a change", async () => {
  const visit = { figures: situation().figures.concat([{ key: "visitHour", label: "", display: "7 am", source: "/api/v1/x" }, { key: "usual", label: "", display: "Drip", source: "/api/v1/menu" }, { key: "waitInHour", label: "", display: "2m", source: "/api/v1/x" }, { key: "typicalWait", label: "", display: "1m", source: "/api/v1/x" }, { key: "ordersInHour", label: "", display: "9", source: "/api/v1/x" }, { key: "trialName", label: "", display: "x", source: "/api/v1/board" }, { key: "trialWait", label: "", display: "x", source: "/api/v1/board" }]), waitInHour: 120, typicalWait: 60, ordersInHour: 9 };
  const keys = new Set(visit.figures.map((f) => f.key));
  for (const r of REGULARS) {
    for (const trial of [null, ...LEVER_IDS.map((lever) => ({ lever, touches: true }))]) {
      const t = templateCustomer(r, visit, { trial, settled: new Set<Topic>(["line"]) });
      assert.ok(guard(t.note, keys).ok, `${r.id} ${trial?.lever}`);
      assert.ok(t.topic in TOPICS);
    }
    const spoken = await speakAsRegular(r, visit, { trial: null, settled: new Set() }, cfg(JSON.stringify({ note: "It took {waitInHour}.", topic: "parking", mood: "mixed" })));
    assert.equal(spoken.writer, "template", "a topic off the list is turned back");
  }
  for (const mood of ["pleased", "mixed", "let down"] as const)
    for (const decision of [null, ...LEVER_IDS]) {
      const s = situation({ mood });
      const keys = new Set([...s.figures.map((f) => f.key), "chosen", "startsOn", "chosenCost"]);
      assert.ok(guard(templateManager(s, decision), keys).ok, `${mood} ${decision}`);
    }
});

const d = (over: Partial<Deltas>): Deltas => ({ wait: 0, slow: 0, orders: 0, takings: 0, staffHoursPerDay: 0, ...over });

test("the verdict keeps a plain win and takes back a plain loss", () => {
  assert.equal(shouldKeep(d({ wait: -0.2, slow: -0.3 }), "pickupShelf"), true);
  assert.equal(shouldKeep(d({ wait: 0.1, takings: -0.03 }), "sidewalkSign"), false);
  assert.equal(shouldKeep(d({ staffHoursPerDay: 2 }), "eveningBarista"), false, "costs hours and moves nothing");
});

test("the verdict makes a barista hour earn its keep: 5% off the typical wait for each extra hour a day", () => {
  assert.equal(shouldKeep(d({ wait: -0.07, staffHoursPerDay: 2 }), "eveningBarista"), false, "7% is short of the 10% two hours must find");
  assert.equal(shouldKeep(d({ wait: -0.12, staffHoursPerDay: 2 }), "eveningBarista"), true);
  assert.equal(shouldKeep(d({ wait: -0.17, staffHoursPerDay: 3 }), "rushBarista"), true, "the morning rush finds its 15%");
  assert.equal(shouldKeep(d({ wait: -0.1, takings: 0.03 }), "pastryPairing"), true, "no hours, so no bar beyond better and not worse");
  assert.equal(shouldKeep(d({ wait: 0.08, takings: 0.05 }), "pastryPairing"), false, "takings can't buy a much slower wait");
});
