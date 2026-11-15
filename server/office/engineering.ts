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

/** Each running claim's figures. A claim whose figure hasn't been measured yet shows none, never a guess. */
async function figuresFor(db: Db, now: Date): Promise<Record<string, Figure[]>> {
  const [facts, shop] = await Promise.all([latestFacts(db), ordersToDate(db, now)]);
  const tests = facts.get("unit-tests");
  const t = tests?.value as FactValue<"unit-tests"> | undefined;
  return {
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
