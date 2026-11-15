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

const SEV = (moderate = 0, high = 0) => ({ critical: 0, high, moderate, low: 0 });
const devsecopsRun = (id: number, over: { gate?: unknown; codeScanningOpen?: number | null; all?: ReturnType<typeof SEV> } = {}) => ({
  run: run(id),
  facts: [
    { kind: "unit-tests", value: { passed: 48, failed: 0, skipped: 0, durationMs: 5_500 } },
    { kind: "coverage", value: { lines: 94.81, branches: 86.72, functions: 82.84, files: 29, gate: over.gate ?? null } },
    {
      kind: "security",
      value: { codeScanningOpen: over.codeScanningOpen ?? null, audit: { production: SEV(), all: over.all ?? SEV(11) }, sonarGate: null },
    },
  ],
});
const figuresOf = async (at: number) => {
  const e = Engineering.parse((await engineering(db, new Date(NOON.getTime() + at))).body);
  return new Map(e.claims.find((c) => c.id === "devsecops")!.figures.map((f) => [f.label, f.display]));
};

test("devsecops: coverage and security figures, with nothing shown for a tool that hasn't run", async () => {
  assert.equal((await ingestCi(db, req(devsecopsRun(201)), new Date(NOON.getTime() + 180_000), SECRET)).status, 201);
  const f = await figuresOf(240_000);
  assert.equal(f.get("Line coverage, 29 modules"), "94.8%");
  assert.equal(f.get("Branch coverage"), "86.7%");
  assert.equal(f.get("Coverage gate"), "No bar set yet", "no bar is said plainly, never shown as a pass");
  assert.equal(f.get("Known holes in shipped packages"), "0");
  assert.equal(f.get("In dev tooling only"), "11 moderate", "the dev tools' holes are shown beside the zero");
  assert.ok(!f.has("Open CodeQL alerts") && !f.has("SonarCloud quality gate"), "a tool that hasn't analysed main shows nothing");
});

test("devsecops: a gate states its own rule and verdict; mixed severities name the worst", async () => {
  const gate = { rule: "lines ≥ 95%", passed: false };
  await ingestCi(db, req(devsecopsRun(202, { gate, codeScanningOpen: 2, all: SEV(11, 1) })), new Date(NOON.getTime() + 300_000), SECRET);
  const f = await figuresOf(360_000);
  assert.equal(f.get("Gate: lines ≥ 95%"), "Failed");
  assert.equal(f.get("Open CodeQL alerts"), "2");
  assert.equal(f.get("In dev tooling only"), "12, worst high");
});

test("ingest refuses a coverage over 100% or a gate with no rule", async () => {
  const body = devsecopsRun(203);
  const cov = body.facts[1]!.value as Record<string, unknown>;
  for (const value of [{ ...cov, lines: 101 }, { ...cov, gate: { rule: "", passed: true } }]) {
    const bad = { ...body, facts: [body.facts[0], { kind: "coverage", value }] };
    assert.equal((await ingestCi(db, req(bad), NOON, SECRET)).status, 422);
  }
});

test("the claims: eleven, one exhibit each, and the API documents them", () => {
  assert.deepEqual(CLAIMS.map((c) => c.exhibit).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(new Set(CLAIMS.map((c) => c.id)).size, CLAIMS.length);
  for (const c of CLAIMS) assert.match(c.gm, /\*\*.+\*\*/, `${c.id} keeps the résumé's headline figure`);
  const doc = openApiDocument() as { paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } };
  assert.ok(doc.paths["/engineering"]);
  assert.ok(doc.components.schemas.Engineering && doc.components.schemas.Figure);
});

test("excel-export: the shop's own month counted live, and the CI benchmark's rows, time and heap", async () => {
  const at = NOON.getTime() + 420_000;
  const value = { days: 90, rows: 38_266, bytes: 315_783, durationMs: 1_934, heapPeakMb: 1, baseline: { days: 14, rows: 5_845, heapPeakMb: 0.9 } };
  const body = { run: run(301), facts: [{ kind: "export", value }] };
  assert.equal((await ingestCi(db, req(body), new Date(at), SECRET)).status, 201);
  const e = Engineering.parse((await engineering(db, new Date(at + 60_000))).body);
  const f = new Map(e.claims.find((c) => c.id === "excel-export")!.figures.map((x) => [x.label, x]));
  assert.equal(f.get("Rows in a 90-day export")!.display, "38,266");
  assert.equal(f.get("Streamed and checked in")!.display, "1.9 s");
  assert.equal(f.get("Peak live heap (14 days: 0.9 MB)")!.display, "1.0 MB");
  assert.equal(f.get("Lines in the shop's last 28 days")!.source, "live");
  const bad = { ...body, facts: [{ kind: "export", value: { ...value, heapPeakMb: -1 } }] };
  assert.equal((await ingestCi(db, req(bad), new Date(at), SECRET)).status, 422);
});
