// What the back office shows and /api/v1/engineering returns: each résumé claim with the figures
// its twin has measured. One function feeds both, so the page and the API cannot disagree.

import type { Db } from "@/server/platform/db/client";
import { deployCounts, factHistory, latestFacts, ordersToDate, type StoredFact } from "./repository";
import { spanStats } from "@/server/reporting";
import { briefCounts, type BriefCounts } from "@/server/brief";
import { addDays, shopToday } from "@/lib/time";
import { CLAIMS, codeUrl, type Claim } from "./claims";
import type { FactKind, FactValue } from "./facts";

export type Figure = {
  label: string;
  /** the figure as the page prints it, "1,204" or "212 passing" */
  display: string;
  value: number;
  /** "live" is counted at request time; "ci" was measured by the linked run */
  source: "live" | "ci";
  measuredAt: string;
  runUrl: string | null;
  sha: string | null;
};

/** One measure across several things, charted on the card: the load test's P95 by endpoint. */
export type Chart = {
  title: string;
  bars: { label: string; value: number; display: string }[];
  runUrl: string;
  sha: string;
  measuredAt: string;
};

/** A run-by-run series for a sparkline, oldest first. */
export type Trend = { at: string; value: number }[];
type Sev = { critical: number; high: number; moderate: number; low: number };

/**
 * What each card draws, from the same stored facts as its figures. The page's only; the API's
 * schema doesn't list it, so /api/v1/engineering stays figures and links.
 */
export type Visual =
  | { kind: "full-stack"; orders: number; visitor: number; tests: Trend }
  | {
      kind: "devsecops";
      coverage: { lines: number; branches: number; functions: number; bars: Bars | null } | null;
      audit: { shipped: Sev; tooling: Sev } | null;
    }
  | { kind: "ui-tests"; tests: number; projects: string[]; passed: number; flaky: number; failed: number; skipped: number; took: Trend }
  | { kind: "excel-export"; spans: { days: number; rows: number; heapMb: number }[] }
  | { kind: "barcode"; read: number; unread: number; refused: number; damagedRead: number; misread: number }
  | { kind: "quality-gates"; gates: { name: string; outcome: "success" | "failure" | "skipped" | "cancelled" }[]; baselines: { compared: number; matched: number } | null }
  | { kind: "ai-adoption"; written: number; byModel: number; guarded: number; gap: { changed: number; uncovered: number } | null }
  | { kind: "re-architecture"; modules: number; uses: [string, string][]; violations: number };

export type ClaimReport = Omit<Claim, "code"> & { code: { label: string; url: string }[]; figures: Figure[]; chart: Chart | null; visual: Visual | null };

const n = (x: number) => x.toLocaleString("en-US");

const live = (label: string, value: number, display: string, now: Date): Figure => ({
  label, value, display, source: "live", measuredAt: now.toISOString(), runUrl: null, sha: null,
});
const fromCi = (label: string, value: number, display: string, f: StoredFact): Figure => ({
  label, value, display, source: "ci", measuredAt: f.recordedAt.toISOString(), runUrl: f.runUrl, sha: f.sha,
});

const pct = (x: number) => `${x.toFixed(1)}%`;

/** 59.6 s is "1 min 0 s", not "0 min 60 s": round to the second first. */
const minSec = (ms: number) => {
  const took = Math.round(ms / 1000);
  return `${Math.floor(took / 60)} min ${took % 60} s`;
};

function coverageFigures(f: StoredFact | undefined): Figure[] {
  if (!f) return [];
  const c = f.value as FactValue<"coverage">;
  return [
    fromCi(`Line coverage, ${c.files} modules`, c.lines, pct(c.lines), f),
    fromCi("Branch coverage", c.branches, pct(c.branches), f),
    // the gate states its own rule, so the page never claims a bar the code doesn't enforce
    c.gate
      ? fromCi(`Gate: ${c.gate.rule}`, c.gate.passed ? 1 : 0, c.gate.passed ? "Passed" : "Failed", f)
      : fromCi("Coverage gate", 0, "No bar set yet", f),
  ];
}

const SONAR = { OK: "Passed", WARN: "Warning", ERROR: "Failed" } as const;

function securityFigures(f: StoredFact | undefined): Figure[] {
  if (!f) return [];
  const s = f.value as FactValue<"security">;
  const total = (x: FactValue<"security">["audit"]["all"]) => x.critical + x.high + x.moderate + x.low;
  const shipped = total(s.audit.production);
  const tooling = total(s.audit.all) - shipped;
  const levels = (["critical", "high", "moderate", "low"] as const).filter((k) => s.audit.all[k] - s.audit.production[k] > 0);
  // "11 moderate" when they share a severity; otherwise the count and the worst of them
  const toolingDisplay = !tooling ? "0" : levels.length === 1 ? `${n(tooling)} ${levels[0]}` : `${n(tooling)}, worst ${levels[0]}`;
  return [
    ...(s.codeScanningOpen === null ? [] : [fromCi("Open CodeQL alerts", s.codeScanningOpen, n(s.codeScanningOpen), f)]),
    fromCi("Known holes in shipped packages", shipped, n(shipped), f),
    // the dev tools' count is shown too: leaving it out would make the zero above look like the whole story
    fromCi("In dev tooling only", tooling, toolingDisplay, f),
    ...(s.sonarGate === null ? [] : [fromCi("SonarCloud quality gate", s.sonarGate === "OK" ? 1 : 0, SONAR[s.sonarGate], f)]),
  ];
}

const mbs = (x: number) => `${x.toFixed(1)} MB`;

function exportFigures(f: StoredFact | undefined, lines28: number, now: Date): Figure[] {
  const shop = live("Lines in the shop's last 28 days", lines28, n(lines28), now);
  if (!f) return [shop];
  const e = f.value as FactValue<"export">;
  return [
    shop,
    fromCi(`Rows in a ${e.days}-day export`, e.rows, n(e.rows), f),
    fromCi("Streamed and checked in", e.durationMs, `${(e.durationMs / 1000).toFixed(1)} s`, f),
    // the point of streaming: memory stays about one page of rows, however long the span
    fromCi(`Peak live heap (${e.baseline.days} days: ${mbs(e.baseline.heapPeakMb)})`, e.heapPeakMb, mbs(e.heapPeakMb), f),
  ];
}

/** Browser tests here against GM's Selenium suite, and the unit and API tests against GM's 300+. */
function testFigures(ui: StoredFact | undefined, unit: StoredFact | undefined): Figure[] {
  const out: Figure[] = [];
  if (ui) {
    const u = ui.value as FactValue<"ui-tests">;
    const ended = [`${n(u.passed)} passed`, u.flaky && `${n(u.flaky)} flaky`, u.failed && `${n(u.failed)} failed`].filter(Boolean).join(", ");
    out.push(
      fromCi("Browser tests here (100+ Selenium at GM)", u.tests, n(u.tests), ui),
      fromCi(`Runs on ${u.projects.join(" and ")}, last main`, u.passed, ended, ui),
      fromCi("The browser suite took", u.durationMs, `${Math.round(u.durationMs / 1000)} s`, ui),
    );
  }
  if (unit) {
    const t = unit.value as FactValue<"unit-tests">;
    out.push(fromCi("Unit, repository and API tests (300+ at GM)", t.passed, t.failed ? `${n(t.passed)} passing, ${n(t.failed)} failing` : n(t.passed), unit));
  }
  return out;
}

/** The barcodes read back from the pixels, the damaged ones refused, and none read wrong. */
function barcodeFigures(f: StoredFact | undefined): Figure[] {
  if (!f) return [];
  const b = f.value as FactValue<"barcodes">;
  const shown = b.read + b.unread;
  return [
    fromCi(`Barcodes read back from screenshots, last main (${n(b.onPages)} on real order pages)`, b.read, b.unread ? `${n(b.read)} of ${n(shown)}` : n(b.read), f),
    fromCi("Damaged barcodes refused", b.refused, `${n(b.refused)} of ${n(b.damaged)}`, f),
    fromCi("Read as something they don't say", b.misread, n(b.misread), f),
    fromCi("The barcode pass took (by hand at GM: 2+ days a cycle)", b.durationMs, `${Math.round(b.durationMs / 1000)} s`, f),
  ];
}

function gateFigures(f: StoredFact | undefined): Figure[] {
  if (!f) return [];
  const g = f.value as FactValue<"quality-gates">;
  const ran = g.gates.filter((x) => x.outcome !== "skipped");
  const held = ran.filter((x) => x.outcome !== "success").map((x) => x.name);
  return [
    fromCi(
      "The release gate, last main",
      ran.length - held.length,
      g.passed ? `open: ${n(ran.length)} of ${n(ran.length)} gates passed` : `held by ${held.join(", ")}`,
      f,
    ),
    ...(g.baselines
      ? [fromCi("Screenshot baselines matched, every page on a desktop and a phone", g.baselines.matched, `${n(g.baselines.matched)} of ${n(g.baselines.compared)}`, f)]
      : []),
    fromCi("Checkout to verdict (the 35% is GM's; the shop has no before to measure against)", g.durationMs, minSec(g.durationMs), f),
  ];
}

/** The briefs, counted live from their table, and the test gap of the last push to main. */
function aiFigures(b: BriefCounts, gap: StoredFact | undefined, now: Date): Figure[] {
  const out = [
    live("Morning briefs written", b.written, n(b.written), now),
    live("Kept as the model wrote them, every number checked", b.byModel, `${n(b.byModel)} of ${n(b.written)}`, now),
    live("Drafts the guard turned back for a number of their own", b.guarded, n(b.guarded), now),
  ];
  if (gap) {
    const g = gap.value as FactValue<"test-gap">;
    out.push(fromCi("Changed lines no test runs, last push to main", g.uncovered, `${n(g.uncovered)} of ${n(g.changed)}`, gap));
  }
  return out;
}

/** 0.55 s at GM is a P95 in seconds; under a second the shop's read better in ms. */
const latency = (ms: number) => (ms < 1000 ? `${n(ms)} ms` : `${(ms / 1000).toFixed(2)} s`);

/** The load test's run, and its slowest endpoint. The rest of the endpoints are in the chart. */
function loadFigures(f: StoredFact | undefined): Figure[] {
  if (!f) return [];
  const l = f.value as FactValue<"load-test">;
  const slowest = l.endpoints[0]!;
  return [
    fromCi(`Requests in the last run, ${n(l.users)} visitors over ${Math.round(l.durationMs / 1000)} s, ${(l.requests / (l.durationMs / 1000)).toFixed(1)} a second (~26K a run at GM)`, l.requests, n(l.requests), f),
    fromCi(`Read against ${n(l.seed.orders)} orders, ${n(l.seed.days)} days of the shop`, l.errors, l.errors ? `${n(l.errors)} errors` : "No errors", f),
    fromCi("P95, every request", l.p95Ms, latency(l.p95Ms), f),
    fromCi(`Slowest at P95: ${slowest.name}`, slowest.p95Ms, latency(slowest.p95Ms), f),
  ];
}

function loadChart(f: StoredFact | undefined): Chart | null {
  if (!f) return null;
  const l = f.value as FactValue<"load-test">;
  return {
    title: "P95 by endpoint, slowest first",
    bars: l.endpoints.map((e) => ({ label: e.name, value: e.p95Ms, display: latency(e.p95Ms) })),
    runUrl: f.runUrl,
    sha: f.sha,
    measuredAt: f.recordedAt.toISOString(),
  };
}

/**
 * Uptime rounded down, never up: one failed probe in 1,440 is 99.93%, and must not print as 100%.
 * Only a month with no failure at all reads 100%.
 */
const uptimePct = (probes: number, failed: number) => (failed ? Math.floor(((probes - failed) / probes) * 10_000) / 100 : 100);

/** Every deploy counted live, the last one's switch and smoke test, and the uptime probe's month. */
function deployFigures(counts: { deploys: number; clean: number }, last: StoredFact | undefined, up: StoredFact | undefined, now: Date): Figure[] {
  const out: Figure[] = [];
  if (counts.deploys)
    out.push(live("Production deploys through the pipeline, none dropping a request", counts.clean, `${n(counts.clean)} of ${n(counts.deploys)}`, now));
  if (last) {
    const d = last.value as FactValue<"deploy">;
    out.push(
      fromCi(`Requests failed while the last deploy switched over, probed every second (longest wait ${latency(d.probe.longestGapMs)})`, d.probe.failed, `${n(d.probe.failed)} of ${n(d.probe.requests)}`, last),
      fromCi(`Push to live, with ${d.migrations.applied ? `${n(d.migrations.applied)} new migration${d.migrations.applied === 1 ? "" : "s"}` : "no new migrations"}`, d.liveMs, minSec(d.liveMs), last),
      fromCi("Smoke checks on the live site after", d.smoke.passed, `${n(d.smoke.passed)} of ${n(d.smoke.checks)}`, last),
    );
  }
  if (up) {
    const u = up.value as FactValue<"uptime">;
    const p = uptimePct(u.probes, u.failed);
    out.push(fromCi(`Uptime, ${n(u.probes)} probes over ${n(u.days)} days`, p, `${p}%`, up));
  }
  return out;
}

function boundaryFigures(f: StoredFact | undefined): Figure[] {
  if (!f) return [];
  const b = f.value as FactValue<"boundaries">;
  return [
    fromCi(`Domain modules, ${b.publicEntries === b.modules ? "each behind one public entry" : `${b.publicEntries} with a public entry`}`, b.modules, n(b.modules), f),
    fromCi(`Imports across a boundary, of ${n(b.imports)} checked`, b.crossings, n(b.crossings), f),
    fromCi("Boundary breaches", b.violations, n(b.violations), f),
    fromCi("Decision records", b.decisions, n(b.decisions), f),
  ];
}

const trend = <K extends FactKind>(rows: { value: unknown; recordedAt: Date }[], pick: (v: FactValue<K>) => number): Trend =>
  rows.map((r) => ({ at: r.recordedAt.toISOString(), value: pick(r.value as FactValue<K>) }));

type Bars = { lines: number | null; branches: number | null; functions: number | null };
/**
 * The bar a gate's rule (free text, scripts/ci/coverage-bar.mjs) sets for each measure it names:
 * "lines ≥ 90% and branches ≥ 80%" → lines 90, branches 80, functions none. A measure the rule
 * doesn't name gets no line drawn, rather than a guessed one.
 */
const barsOf = (rule: string): Bars => {
  const bar = (name: string) => {
    const m = new RegExp(`\\b${name}\\b[^%\\d]{0,16}(\\d+(?:\\.\\d+)?)\\s*%`, "i").exec(rule);
    return m ? Number(m[1]) : null;
  };
  return { lines: bar("lines?"), branches: bar("branch(?:es)?"), functions: bar("functions?") };
};

/** Each running claim's drawing. Like the figures, a claim with nothing measured draws nothing. */
function visualsFor(
  facts: Map<FactKind, StoredFact>,
  history: { unit: { value: unknown; recordedAt: Date }[]; ui: { value: unknown; recordedAt: Date }[] },
  shop: { orders: number; visitorOrders: number },
  briefs: BriefCounts,
): Record<string, Visual> {
  const v = <K extends FactKind>(k: K) => facts.get(k)?.value as FactValue<K> | undefined;
  const out: Record<string, Visual> = {
    "full-stack": { kind: "full-stack", orders: shop.orders, visitor: shop.visitorOrders, tests: trend<"unit-tests">(history.unit, (t) => t.passed) },
    "ai-adoption": {
      kind: "ai-adoption",
      written: briefs.written,
      byModel: briefs.byModel,
      guarded: briefs.guarded,
      gap: v("test-gap") ? { changed: v("test-gap")!.changed, uncovered: v("test-gap")!.uncovered } : null,
    },
  };
  const cov = v("coverage"), sec = v("security");
  if (cov || sec) {
    const minus = (a: Sev, b: Sev): Sev => ({ critical: a.critical - b.critical, high: a.high - b.high, moderate: a.moderate - b.moderate, low: a.low - b.low });
    out.devsecops = {
      kind: "devsecops",
      coverage: cov ? { lines: cov.lines, branches: cov.branches, functions: cov.functions, bars: cov.gate ? barsOf(cov.gate.rule) : null } : null,
      audit: sec ? { shipped: sec.audit.production, tooling: minus(sec.audit.all, sec.audit.production) } : null,
    };
  }
  const ui = v("ui-tests");
  if (ui) out["ui-tests"] = { kind: "ui-tests", tests: ui.tests, projects: ui.projects, passed: ui.passed, flaky: ui.flaky, failed: ui.failed, skipped: ui.skipped, took: trend<"ui-tests">(history.ui, (u) => u.durationMs) };
  const ex = v("export");
  if (ex) out["excel-export"] = { kind: "excel-export", spans: [{ days: ex.baseline.days, rows: ex.baseline.rows, heapMb: ex.baseline.heapPeakMb }, { days: ex.days, rows: ex.rows, heapMb: ex.heapPeakMb }] };
  const bc = v("barcodes");
  if (bc) out.barcode = { kind: "barcode", read: bc.read, unread: bc.unread, refused: bc.refused, damagedRead: Math.max(0, bc.damaged - bc.refused - bc.misread), misread: bc.misread };
  const qg = v("quality-gates");
  if (qg) out["quality-gates"] = { kind: "quality-gates", gates: qg.gates, baselines: qg.baselines };
  const bd = v("boundaries");
  if (bd) out["re-architecture"] = { kind: "re-architecture", modules: bd.modules, uses: bd.uses.map((u) => u.split("→") as [string, string]), violations: bd.violations };
  return out;
}

/** Each running claim's figures. A claim whose figure hasn't been measured yet shows none, never a guess. */
async function figuresFor(db: Db, now: Date): Promise<{ figures: Record<string, Figure[]>; charts: Record<string, Chart | null>; visuals: Record<string, Visual> }> {
  const today = shopToday(now);
  const [facts, shop, recent, briefs, deploys, unitRuns, uiRuns] = await Promise.all([
    latestFacts(db),
    ordersToDate(db, now),
    spanStats(db, { from: addDays(today, -27), to: today }, now),
    briefCounts(db),
    deployCounts(db),
    factHistory(db, "unit-tests", 20),
    factHistory(db, "ui-tests", 20),
  ]);
  const tests = facts.get("unit-tests");
  const t = tests?.value as FactValue<"unit-tests"> | undefined;
  const visuals = visualsFor(facts, { unit: unitRuns, ui: uiRuns }, shop, briefs);
  const figures: Record<string, Figure[]> = {
    "re-architecture": boundaryFigures(facts.get("boundaries")),
    "ui-tests": testFigures(facts.get("ui-tests"), tests),
    barcode: barcodeFigures(facts.get("barcodes")),
    "quality-gates": gateFigures(facts.get("quality-gates")),
    "ai-adoption": aiFigures(briefs, facts.get("test-gap"), now),
    performance: loadFigures(facts.get("load-test")),
    "zero-downtime": deployFigures(deploys, facts.get("deploy"), facts.get("uptime"), now),
    "excel-export": exportFigures(facts.get("export"), recent.lines, now),
    devsecops: [...coverageFigures(facts.get("coverage")), ...securityFigures(facts.get("security"))],
    "full-stack": [
      live("Orders served to date", shop.orders, n(shop.orders), now),
      live("Placed by visitors to this site", shop.visitorOrders, n(shop.visitorOrders), now),
      ...(tests && t
        ? [fromCi("Tests on main", t.passed, t.failed ? `${n(t.passed)} passing, ${n(t.failed)} failing` : `${n(t.passed)} passing`, tests)]
        : []),
    ],
  };
  return { figures, charts: { performance: loadChart(facts.get("load-test")) }, visuals };
}

export async function engineering(db: Db, now: Date): Promise<{ asOf: string; claims: ClaimReport[] }> {
  const { figures, charts, visuals } = await figuresFor(db, now);
  return {
    asOf: now.toISOString(),
    claims: CLAIMS.map((c) => ({
      ...c,
      code: c.code.map((x) => ({ label: x.label, url: codeUrl(x.path) })),
      figures: figures[c.id] ?? [],
      chart: charts[c.id] ?? null,
      // a claim still to come draws nothing, whatever facts are lying about
      visual: c.status === "running" ? (visuals[c.id] ?? null) : null,
    })),
  };
}
