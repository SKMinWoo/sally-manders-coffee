// What the back office shows and /api/v1/engineering returns: each résumé claim with the figures
// its twin has measured. One function feeds both, so the page and the API cannot disagree.

import type { Db } from "@/server/platform/db/client";
import { deployCounts, latestFacts, ordersToDate, type StoredFact } from "./repository";
import { spanStats } from "@/server/reporting";
import { briefCounts, type BriefCounts } from "@/server/brief";
import { addDays, shopToday } from "@/lib/time";
import { CLAIMS, codeUrl, type Claim } from "./claims";
import type { FactValue } from "./facts";

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

export type ClaimReport = Omit<Claim, "code"> & { code: { label: string; url: string }[]; figures: Figure[]; chart: Chart | null };

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
    fromCi(`Requests in the last run, ${n(l.users)} visitors over ${Math.round(l.durationMs / 1000)} s, ${(l.requests / (l.durationMs / 1000)).toFixed(1)} a second (24,700+ a run at GM)`, l.requests, n(l.requests), f),
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

/** The last main's cluster: what ran, how long Argo CD took to sync it, and what health said. */
function clusterFigures(f: StoredFact | undefined): Figure[] {
  if (!f) return [];
  const c = f.value as FactValue<"cluster">;
  // a pod that answered with another commit is a failed check, whatever its health said
  const answer = !c.commitMatched ? "Another commit answered" : c.health === "ok" ? "OK, on this commit" : "Degraded";
  return [
    fromCi("Services on Kubernetes here (15+ on AKS at GM)", c.services, n(c.services), f),
    fromCi("Pods ready once Argo CD synced the Helm chart, last main", c.pods.ready, `${n(c.pods.ready)} of ${n(c.pods.total)}`, f),
    fromCi(`Applied to synced and healthy, ${n(c.resources)} objects from the chart`, c.syncMs, minSec(c.syncMs), f),
    fromCi("Health, through the shop’s Kubernetes Service", c.commitMatched && c.health === "ok" ? 1 : 0, answer, f),
  ];
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

/** Each running claim's figures. A claim whose figure hasn't been measured yet shows none, never a guess. */
async function figuresFor(db: Db, now: Date): Promise<{ figures: Record<string, Figure[]>; charts: Record<string, Chart | null> }> {
  const today = shopToday(now);
  const [facts, shop, recent, briefs, deploys] = await Promise.all([
    latestFacts(db),
    ordersToDate(db, now),
    spanStats(db, { from: addDays(today, -27), to: today }, now),
    briefCounts(db),
    deployCounts(db),
  ]);
  const tests = facts.get("unit-tests");
  const t = tests?.value as FactValue<"unit-tests"> | undefined;
  const figures = {
    aks: clusterFigures(facts.get("cluster")),
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
  return { figures, charts: { performance: loadChart(facts.get("load-test")) } };
}

export async function engineering(db: Db, now: Date): Promise<{ asOf: string; claims: ClaimReport[] }> {
  const { figures, charts } = await figuresFor(db, now);
  return {
    asOf: now.toISOString(),
    claims: CLAIMS.map((c) => ({
      ...c,
      code: c.code.map((x) => ({ label: x.label, url: codeUrl(x.path) })),
      figures: figures[c.id] ?? [],
      chart: charts[c.id] ?? null,
    })),
  };
}
