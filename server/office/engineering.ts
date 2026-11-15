// What the back office shows and /api/v1/engineering returns: each résumé claim with the figures
// its twin has measured. One function feeds both, so the page and the API cannot disagree.

import type { Db } from "@/server/db/client";
import { latestFacts, ordersToDate, type StoredFact } from "@/server/db/repositories/facts";
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

export type ClaimReport = Omit<Claim, "code"> & { code: { label: string; url: string }[]; figures: Figure[] };

const n = (x: number) => x.toLocaleString("en-US");

const live = (label: string, value: number, display: string, now: Date): Figure => ({
  label, value, display, source: "live", measuredAt: now.toISOString(), runUrl: null, sha: null,
});
const fromCi = (label: string, value: number, display: string, f: StoredFact): Figure => ({
  label, value, display, source: "ci", measuredAt: f.recordedAt.toISOString(), runUrl: f.runUrl, sha: f.sha,
});

const pct = (x: number) => `${x.toFixed(1)}%`;

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

/** Each running claim's figures. A claim whose figure hasn't been measured yet shows none, never a guess. */
async function figuresFor(db: Db, now: Date): Promise<Record<string, Figure[]>> {
  const [facts, shop] = await Promise.all([latestFacts(db), ordersToDate(db, now)]);
  const tests = facts.get("unit-tests");
  const t = tests?.value as FactValue<"unit-tests"> | undefined;
  return {
    devsecops: [...coverageFigures(facts.get("coverage")), ...securityFigures(facts.get("security"))],
    "full-stack": [
      live("Orders served to date", shop.orders, n(shop.orders), now),
      live("Placed by visitors to this site", shop.visitorOrders, n(shop.visitorOrders), now),
      ...(tests && t
        ? [fromCi("Tests on main", t.passed, t.failed ? `${n(t.passed)} passing, ${n(t.failed)} failing` : `${n(t.passed)} passing`, tests)]
        : []),
    ],
  };
}

export async function engineering(db: Db, now: Date): Promise<{ asOf: string; claims: ClaimReport[] }> {
  const figures = await figuresFor(db, now);
  return {
    asOf: now.toISOString(),
    claims: CLAIMS.map((c) => ({
      ...c,
      code: c.code.map((x) => ({ label: x.label, url: codeUrl(x.path) })),
      figures: figures[c.id] ?? [],
    })),
  };
}
