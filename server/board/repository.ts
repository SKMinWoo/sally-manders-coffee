// The board's tables: the morning calls and the changes tried. Only this module writes them.

import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { calls, experiments } from "@/server/platform/db/schema";
import type { BriefFigure } from "@/server/brief";
import { isLeverId, type LeverId, type Topic } from "@/server/simulator";
import type { Effect } from "./measure";

export type Mood = "pleased" | "mixed" | "let down";

export type CustomerPayload = { topic: Topic; mood: Mood };
export type ManagerPayload = {
  /** the change the manager chose, or null to hold */
  decision: LeverId | null;
  /** what the manager asked for, when it was turned down, and why */
  declined: { asked: string; reason: string } | null;
  /** the model that made the decision, or "template" when the rule did */
  decidedBy: string;
};

type CallBase = {
  day: ShopDate;
  speaker: string;
  body: string;
  figures: BriefFigure[];
  writer: string;
  refused: string | null;
  guarded: boolean;
  writtenAt: string;
};
export type CustomerCall = CallBase & { kind: "customer"; payload: CustomerPayload };
export type ManagerCall = CallBase & { kind: "manager"; payload: ManagerPayload };
export type Call = CustomerCall | ManagerCall;

const asCall = (r: typeof calls.$inferSelect): Call =>
  ({ ...r, figures: r.figures as BriefFigure[], payload: r.payload, writtenAt: r.writtenAt.toISOString() }) as Call;

/** True when this call stored it; false when the day already had one of its kind. */
export async function insertCall(db: Db, c: Omit<Call, "writtenAt">): Promise<boolean> {
  const rows = await db.insert(calls).values(c).onConflictDoNothing().returning({ day: calls.day });
  return rows.length === 1;
}

export async function callsOn(db: Db, day: ShopDate): Promise<{ customer: CustomerCall | null; manager: ManagerCall | null }> {
  const rows = (await db.select().from(calls).where(eq(calls.day, day))).map(asCall);
  return {
    customer: (rows.find((c) => c.kind === "customer") as CustomerCall | undefined) ?? null,
    manager: (rows.find((c) => c.kind === "manager") as ManagerCall | undefined) ?? null,
  };
}

/** Every call from `from` on, newest day first. */
export async function callsSince(db: Db, from: ShopDate): Promise<Call[]> {
  return (await db.select().from(calls).where(gte(calls.day, from)).orderBy(desc(calls.day), asc(calls.kind))).map(asCall);
}

export type Verdict = "kept" | "rolled-back";

export interface Experiment {
  id: number;
  lever: LeverId;
  heard: Topic;
  proposedOn: ShopDate;
  startsOn: ShopDate;
  endsOn: ShopDate;
  status: "live" | "measured";
  verdict: Verdict | null;
  until: ShopDate | null;
  effect: Effect | null;
  measuredOn: ShopDate | null;
}

const asExperiment = (r: typeof experiments.$inferSelect): Experiment | null =>
  isLeverId(r.lever) ? { ...r, lever: r.lever, heard: r.heard as Topic, effect: r.effect as Effect | null } : null; // a lever since taken out of the catalogue drops off the board

export async function allExperiments(db: Db): Promise<Experiment[]> {
  const rows = await db.select().from(experiments).orderBy(asc(experiments.startsOn), asc(experiments.id));
  return rows.map(asExperiment).filter((e): e is Experiment => e !== null);
}

export async function liveExperiment(db: Db): Promise<Experiment | null> {
  const [r] = await db.select().from(experiments).where(eq(experiments.status, "live"));
  return r ? asExperiment(r) : null;
}

/** Null when another change is already live (the database allows one at a time). */
export async function startExperiment(
  db: Db,
  e: Pick<Experiment, "lever" | "heard" | "proposedOn" | "startsOn" | "endsOn">,
): Promise<Experiment | null> {
  const rows = await db.insert(experiments).values(e).onConflictDoNothing().returning();
  return rows[0] ? asExperiment(rows[0]) : null;
}

/** Closes a live change with its verdict. False when it was measured already (a second run of the job). */
export async function closeExperiment(
  db: Db,
  id: number,
  done: { verdict: Verdict; effect: Effect; until: ShopDate | null; measuredOn: ShopDate },
): Promise<boolean> {
  const rows = await db
    .update(experiments)
    .set({ status: "measured", ...done })
    .where(and(eq(experiments.id, id), eq(experiments.status, "live")))
    .returning({ id: experiments.id });
  return rows.length === 1;
}

export async function experimentCounts(db: Db): Promise<{ tried: number; kept: number; first: ShopDate | null }> {
  const [r] = await db
    .select({
      tried: sql<number>`count(*)::int`,
      kept: sql<number>`(count(*) filter (where ${experiments.verdict} = 'kept'))::int`,
      first: sql<ShopDate | null>`min(${experiments.startsOn})::text`,
    })
    .from(experiments);
  return { tried: r?.tried ?? 0, kept: r?.kept ?? 0, first: r?.first ?? null };
}
