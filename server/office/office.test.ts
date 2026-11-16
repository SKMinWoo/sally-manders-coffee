import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "@/server/platform/db/client";
import { testDb } from "@/server/platform/db/test-db";
import { ensureDays } from "@/server/simulator";
import { openApiDocument } from "@/server/api/openapi";
import { Engineering, Problem } from "@/server/api/schemas";
import { engineering } from "@/server/api/v1";
import { writeBrief } from "@/server/brief";
import { existsSync } from "node:fs";
import { CLAIMS } from "./claims";
import { FACTORS } from "./twelve-factor";
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

test("re-architecture: modules, imports checked across a boundary, breaches and decisions", async () => {
  const at = NOON.getTime() + 480_000;
  const value = {
    modules: 5, publicEntries: 5, files: 96, imports: 371, crossings: 48, violations: 0,
    uses: ["office→orders", "orders→menu"], decisions: 4,
  };
  const body = { run: run(401), facts: [{ kind: "boundaries", value }] };
  assert.equal((await ingestCi(db, req(body), new Date(at), SECRET)).status, 201);
  const e = Engineering.parse((await engineering(db, new Date(at + 60_000))).body);
  const c = e.claims.find((x) => x.id === "re-architecture")!;
  const f = new Map(c.figures.map((x) => [x.label, x.display]));
  assert.equal(f.get("Domain modules, each behind one public entry"), "5");
  assert.equal(f.get("Imports across a boundary, of 371 checked"), "48");
  assert.equal(f.get("Boundary breaches"), "0");
  assert.equal(f.get("Decision records"), "4");
  for (const uses of [["orders->menu"], ["Orders→Menu"]]) {
    const bad = { ...body, facts: [{ kind: "boundaries", value: { ...value, uses } }] };
    assert.equal((await ingestCi(db, req(bad), new Date(at), SECRET)).status, 422, `uses ${uses[0]}`);
  }
});

test("ui-tests: the browser suite's tests, its runs and how they ended, beside the unit and API tests", async () => {
  const at = NOON.getTime() + 540_000;
  const value = { tests: 35, projects: ["desktop", "phone"], runs: 70, passed: 68, flaky: 1, failed: 1, skipped: 0, durationMs: 32_700 };
  const body = { run: run(501), facts: [{ kind: "ui-tests", value }, report(501, 70).facts[0]] };
  assert.equal((await ingestCi(db, req(body), new Date(at), SECRET)).status, 201);
  const e = Engineering.parse((await engineering(db, new Date(at + 60_000))).body);
  const c = e.claims.find((x) => x.id === "ui-tests")!;
  assert.equal(c.status, "running");
  const f = new Map(c.figures.map((x) => [x.label, x.display]));
  assert.equal(f.get("Browser tests here (100+ Selenium at GM)"), "35");
  assert.equal(f.get("Runs on desktop and phone, last main"), "68 passed, 1 flaky, 1 failed");
  assert.equal(f.get("The browser suite took"), "33 s");
  assert.equal(f.get("Unit, repository and API tests (300+ at GM)"), "70");
  for (const bad of [{ ...value, projects: [] }, { ...value, projects: ["Desktop Chrome"] }, { ...value, passed: -1 }, { ...value, retries: 1 }]) {
    const b = { run: run(502), facts: [{ kind: "ui-tests", value: bad }] };
    assert.equal((await ingestCi(db, req(b), new Date(at), SECRET)).status, 422, JSON.stringify(bad));
  }
});

test("barcode: read back from the pixels, damaged ones refused, none read wrong", async () => {
  const at = NOON.getTime() + 600_000;
  const value = { read: 73, onPages: 2, unread: 1, misread: 0, damaged: 32, refused: 32, durationMs: 23_300 };
  assert.equal((await ingestCi(db, req({ run: run(601), facts: [{ kind: "barcodes", value }] }), new Date(at), SECRET)).status, 201);
  const e = Engineering.parse((await engineering(db, new Date(at + 60_000))).body);
  const c = e.claims.find((x) => x.id === "barcode")!;
  assert.equal(c.status, "running");
  const f = new Map(c.figures.map((x) => [x.label, x.display]));
  assert.equal(f.get("Barcodes read back from screenshots, last main (2 on real order pages)"), "73 of 74");
  assert.equal(f.get("Damaged barcodes refused"), "32 of 32");
  assert.equal(f.get("Read as something they don't say"), "0");
  assert.equal(f.get("The barcode pass took (by hand at GM: 2+ days a cycle)"), "23 s");
  for (const bad of [{ ...value, misread: -1 }, { ...value, read: 1.5 }, { ...value, scanned: 3 }]) {
    const b = { run: run(602), facts: [{ kind: "barcodes", value: bad }] };
    assert.equal((await ingestCi(db, req(b), new Date(at), SECRET)).status, 422, JSON.stringify(bad));
  }
});

test("quality gates: the verdict, what held it, the baselines and the time", async () => {
  const at = NOON.getTime() + 700_000;
  const gates = [
    { name: "types", outcome: "success" },
    { name: "browser tests and baselines", outcome: "success" },
    { name: "SonarCloud", outcome: "skipped" },
  ];
  const value = { passed: true, gates, baselines: { compared: 12, matched: 12 }, durationMs: 412_400 };
  assert.equal((await ingestCi(db, req({ run: run(701), facts: [{ kind: "quality-gates", value }] }), new Date(at), SECRET)).status, 201);
  let e = Engineering.parse((await engineering(db, new Date(at + 60_000))).body);
  let c = e.claims.find((x) => x.id === "quality-gates")!;
  assert.equal(c.status, "running");
  let f = new Map(c.figures.map((x) => [x.label, x.display]));
  assert.equal(f.get("The release gate, last main"), "open: 2 of 2 gates passed", "a gate that wasn't set up isn't counted");
  assert.equal(f.get("Screenshot baselines matched, every page on a desktop and a phone"), "12 of 12");
  assert.equal(f.get("Checkout to verdict (the 35% is GM's; the shop has no before to measure against)"), "6 min 52 s");

  const held = { ...value, passed: false, gates: [gates[0], { ...gates[1]!, outcome: "failure" }], baselines: { compared: 12, matched: 10 } };
  assert.equal((await ingestCi(db, req({ run: run(702), facts: [{ kind: "quality-gates", value: held }] }), new Date(at + 1000), SECRET)).status, 201);
  e = Engineering.parse((await engineering(db, new Date(at + 60_000))).body);
  c = e.claims.find((x) => x.id === "quality-gates")!;
  f = new Map(c.figures.map((x) => [x.label, x.display]));
  assert.equal(f.get("The release gate, last main"), "held by browser tests and baselines");
  assert.equal(f.get("Screenshot baselines matched, every page on a desktop and a phone"), "10 of 12");

  for (const bad of [{ ...value, gates: [] }, { ...value, gates: [{ name: "types", outcome: "neutral" }] }, { ...value, passed: "yes" }]) {
    const b = { run: run(703), facts: [{ kind: "quality-gates", value: bad }] };
    assert.equal((await ingestCi(db, req(b), new Date(at), SECRET)).status, 422, JSON.stringify(bad));
  }
});

test("ai-adoption: briefs counted live, the guard's refusals apart, and CI's test gap", async () => {
  // its own database, so the days written here don't change the shared one's order counts
  const own = await testDb();
  try {
    await ensureDays(own.db, ["2026-11-11", "2026-11-12"]);
    const noNetwork = (async () => {
      throw new Error("no request should have been made");
    }) as typeof fetch;
    const says = (text: string) =>
      (async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })) as typeof fetch;
    await writeBrief(own.db, new Date("2026-11-12T15:00:00Z"), { key: "k", fetch: says("{orders} orders, 9 of them late.") }); // guarded
    await writeBrief(own.db, NOON, { key: "k", fetch: says("{orders} orders on {weekday}.") }); // kept
    assert.deepEqual(await writeBrief(own.db, NOON, { fetch: noNetwork }), { day: "2026-11-12", written: false });

    const at = NOON.getTime() + 800_000;
    const value = { changed: 412, uncovered: 9, files: 14 };
    assert.equal((await ingestCi(own.db, req({ run: run(801), facts: [{ kind: "test-gap", value }] }), new Date(at), SECRET)).status, 201);
    const e = Engineering.parse((await engineering(own.db, new Date(at + 60_000))).body);
    const c = e.claims.find((x) => x.id === "ai-adoption")!;
    assert.equal(c.status, "running");
    const f = new Map(c.figures.map((x) => [x.label, x.display]));
    assert.equal(f.get("Morning briefs written"), "2");
    assert.equal(f.get("Kept as the model wrote them, every number checked"), "1 of 2");
    assert.equal(f.get("Drafts the guard turned back for a number of their own"), "1");
    assert.equal(f.get("Changed lines no test runs, last push to main"), "9 of 412");

    for (const bad of [{ ...value, uncovered: -1 }, { ...value, changed: 1.5 }, { ...value, lines: 3 }]) {
      const b = { run: run(802), facts: [{ kind: "test-gap", value: bad }] };
      assert.equal((await ingestCi(own.db, req(b), new Date(at), SECRET)).status, 422, JSON.stringify(bad));
    }
  } finally {
    await own.close();
  }
});

test("every file a claim or a factor points at is in the repository", () => {
  const paths = [
    ...CLAIMS.flatMap((c) => c.code.map((x) => x.path)),
    ...FACTORS.flatMap((f) => f.evidence.map((x) => x.path)),
  ];
  for (const p of paths) {
    const file = p.startsWith("/") ? `app${p.split("#")[0]}/page.tsx` : p; // a page of the site (and a place on it), or a file
    assert.ok(existsSync(file), `${p} is linked but ${file} doesn't exist`);
  }
  assert.deepEqual(FACTORS.map((f) => f.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});
