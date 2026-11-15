import { and, count, desc, eq } from "drizzle-orm";
import type { FactKind, IngestBody } from "./facts";
import type { Db } from "@/server/platform/db/client";
import { engineeringFacts, orders } from "@/server/platform/db/schema";
import { placedBy } from "@/server/orders";

export type StoredFact = { kind: FactKind; value: unknown; runUrl: string; sha: string; recordedAt: Date };

/**
 * Stores one run's figures. A retried post of the same run is stored once: the unique (kind, run)
 * key turns the repeat into a no-op, so CI can retry freely. Returns how many were new.
 */
export async function recordFacts(db: Db, body: IngestBody, at: Date): Promise<number> {
  const rows = await db
    .insert(engineeringFacts)
    .values(body.facts.map((f) => ({ kind: f.kind, value: f.value, runId: body.run.id, runUrl: body.run.url, sha: body.run.sha, recordedAt: at })))
    .onConflictDoNothing({ target: [engineeringFacts.kind, engineeringFacts.runId] })
    .returning({ id: engineeringFacts.id });
  return rows.length;
}

/** The most recent figure of each kind, by when it was recorded. */
export async function latestFacts(db: Db): Promise<Map<FactKind, StoredFact>> {
  const rows = await db
    .selectDistinctOn([engineeringFacts.kind], {
      kind: engineeringFacts.kind,
      value: engineeringFacts.value,
      runUrl: engineeringFacts.runUrl,
      sha: engineeringFacts.sha,
      recordedAt: engineeringFacts.recordedAt,
    })
    .from(engineeringFacts)
    .orderBy(engineeringFacts.kind, desc(engineeringFacts.recordedAt));
  return new Map(rows.map((r) => [r.kind as FactKind, { ...r, kind: r.kind as FactKind }]));
}

/** Every order placed up to `asOf`, and how many of them visitors placed: the shop's running total. */
export async function ordersToDate(db: Db, asOf: Date): Promise<{ orders: number; visitorOrders: number }> {
  const [all] = await db.select({ n: count() }).from(orders).where(placedBy(asOf));
  const [visitor] = await db.select({ n: count() }).from(orders).where(and(placedBy(asOf), eq(orders.source, "visitor")));
  return { orders: all?.n ?? 0, visitorOrders: visitor?.n ?? 0 };
}
