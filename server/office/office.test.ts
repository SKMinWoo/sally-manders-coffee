import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "@/server/db/client";
import { testDb } from "@/server/db/test-db";
import { ensureDays } from "@/server/sim/run";
import { openApiDocument } from "@/server/api/openapi";
import { Engineering, Problem } from "@/server/api/schemas";
import { engineering } from "@/server/api/v1";
import { CLAIMS } from "./claims";
import { REPO } from "./facts";
import { ingestCi, MAX_BODY_BYTES, type IngestRequest } from "./ingest";

let db: Db, close: () => Promise<void>;
before(async () => ({ db, close } = await testDb()));
after(() => close());

const SECRET = "s".repeat(48);
const NOON = new Date("2026-11-13T18:00:00Z");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const run = (id: number) => ({ id, url: `https://github.com/${REPO}/actions/runs/${id}`, sha: SHA });
const report = (id: number, passed = 212) => ({ run: run(id), facts: [{ kind: "unit-tests", value: { passed, failed: 0, skipped: 0, durationMs: 41_000 } }] });
const req = (body: unknown, over: Partial<IngestRequest> = {}): IngestRequest => ({
  authorization: `Bearer ${SECRET}`,
  contentType: "application/json",
  body: typeof body === "string" ? body : JSON.stringify(body),
  ...over,
});

test("ingest refuses without the secret, with the wrong one, and when none is configured", async () => {
  for (const [r, secret] of [
    [req(report(1), { authorization: null }), SECRET],
    [req(report(1), { authorization: `Bearer ${"t".repeat(48)}` }), SECRET],
    [req(report(1), { authorization: SECRET }), SECRET], // no "Bearer "
    [req(report(1)), undefined],
    [req(report(1)), ""],
  ] as const) {
    const res = await ingestCi(db, r, NOON, secret);
    assert.equal(res.status, 401);
    assert.equal(Problem.parse(res.body).status, 401);
  }
});

test("ingest refuses what isn't a run report: wrong type, too big, not JSON", async () => {
  assert.equal((await ingestCi(db, req(report(1), { contentType: "text/plain" }), NOON, SECRET)).status, 415);
  assert.equal((await ingestCi(db, req("x".repeat(MAX_BODY_BYTES + 1)), NOON, SECRET)).status, 413);
  assert.equal((await ingestCi(db, req("{not json"), NOON, SECRET)).status, 400);
});

test("ingest refuses a report that breaks the contract, and says where", async () => {
  const good = report(7);
  const bad: [string, unknown][] = [
    ["an unknown kind", { ...good, facts: [{ kind: "vibes", value: { passed: 1 } }] }],
    ["an extra field", { ...good, facts: [{ kind: "unit-tests", value: { ...good.facts[0]!.value, flaky: 3 } }] }],
    ["a count as a string", { ...good, facts: [{ kind: "unit-tests", value: { ...good.facts[0]!.value, passed: "212" } }] }],
    ["a negative count", { ...good, facts: [{ kind: "unit-tests", value: { ...good.facts[0]!.value, failed: -1 } }] }],
    ["a short sha", { ...good, run: { ...good.run, sha: "abc123" } }],
    ["another repository's run", { ...good, run: { ...good.run, url: "https://github.com/someone/else/actions/runs/7" } }],
    ["a url naming a different run", { ...good, run: { ...good.run, url: `https://github.com/${REPO}/actions/runs/8` } }],
    ["the same kind twice", { ...good, facts: [good.facts[0], good.facts[0]] }],
    ["no figures at all", { ...good, facts: [] }],
  ];
  for (const [why, body] of bad) {
    const res = await ingestCi(db, req(body), NOON, SECRET);
    assert.equal(res.status, 422, why);
    assert.ok(Problem.parse(res.body).detail, `${why}: the problem says which field`);
  }
});

test("a run's report is stored once, however many times CI retries it", async () => {
  const first = await ingestCi(db, req(report(101)), NOON, SECRET);
  assert.equal(first.status, 201);
  assert.deepEqual(first.body, { stored: 1, of: 1 });
  const again = await ingestCi(db, req(report(101)), NOON, SECRET);
  assert.equal(again.status, 200);
  assert.deepEqual(again.body, { stored: 0, of: 1 });
});

test("the engineering report: every claim, figures only where something was measured, the latest run's", async () => {
  await ensureDays(db, ["2026-11-13"]);
  await ingestCi(db, req(report(102, 230)), new Date(NOON.getTime() + 60_000), SECRET);

  const r = await engineering(db, new Date(NOON.getTime() + 120_000));
  const e = Engineering.parse(r.body);
  assert.equal(e.claims.length, 11);

  const fs = e.claims.find((c) => c.id === "full-stack")!;
  assert.equal(fs.status, "running");
  const tests = fs.figures.find((f) => f.source === "ci")!;
  assert.equal(tests.value, 230, "the most recent run wins");
  assert.equal(tests.runUrl, `https://github.com/${REPO}/actions/runs/102`);
  const served = fs.figures.find((f) => f.label === "Orders served to date")!;
  assert.ok(served.value > 0 && served.source === "live");

  for (const c of e.claims.filter((c) => c.status === "coming")) assert.deepEqual(c.figures, [], `${c.id} shows nothing it hasn't measured`);
});

test("the claims: eleven, one exhibit each, and the API documents them", () => {
  assert.deepEqual(CLAIMS.map((c) => c.exhibit).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(new Set(CLAIMS.map((c) => c.id)).size, CLAIMS.length);
  for (const c of CLAIMS) assert.match(c.gm, /\*\*.+\*\*/, `${c.id} keeps the résumé's headline figure`);
  const doc = openApiDocument() as { paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } };
  assert.ok(doc.paths["/engineering"]);
  assert.ok(doc.components.schemas.Engineering && doc.components.schemas.Figure);
});
