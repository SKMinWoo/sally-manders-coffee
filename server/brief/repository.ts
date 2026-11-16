// The briefs table. Only this module writes it; the back office reads its counts through the index.

import { desc, eq, sql } from "drizzle-orm";
import type { ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { briefs } from "@/server/platform/db/schema";
import type { BriefFigure } from "./figures";

export type Brief = {
  day: ShopDate;
  body: string;
  figures: BriefFigure[];
  writer: string;
  refused: string | null;
  /** the guard turned the model's draft back, rather than the model not answering */
  guarded: boolean;
  /** an ISO string, so a cached brief comes back the same shape it went in */
  writtenAt: string;
};

export async function hasBrief(db: Db, day: ShopDate): Promise<boolean> {
  const [r] = await db.select({ day: briefs.day }).from(briefs).where(eq(briefs.day, day));
  return r !== undefined;
}

/** True when this call stored it; false when the day already had a brief. */
export async function insertBrief(db: Db, b: Omit<Brief, "writtenAt">): Promise<boolean> {
  const rows = await db.insert(briefs).values(b).onConflictDoNothing().returning({ day: briefs.day });
  return rows.length === 1;
}

export async function latestBrief(db: Db): Promise<Brief | null> {
  const [r] = await db.select().from(briefs).orderBy(desc(briefs.day)).limit(1);
  return r ? { ...r, figures: r.figures as BriefFigure[], writtenAt: r.writtenAt.toISOString() } : null;
}

export type BriefCounts = {
  /** briefs written in all */
  written: number;
  /** written by a model, its draft kept */
  byModel: number;
  /** drafts the guard (or a failed request) turned back, so the template was used */
  refused: number;
  /** of those, turned back by the guard itself for a number, not for the model failing to answer */
  guarded: number;
};

export async function briefCounts(db: Db): Promise<BriefCounts> {
  const [r] = await db
    .select({
      written: sql<number>`count(*)::int`,
      byModel: sql<number>`(count(*) filter (where ${briefs.writer} <> 'template'))::int`,
      refused: sql<number>`(count(*) filter (where ${briefs.refused} is not null))::int`,
      guarded: sql<number>`(count(*) filter (where ${briefs.guarded}))::int`,
    })
    .from(briefs);
  return { written: r?.written ?? 0, byModel: r?.byModel ?? 0, refused: r?.refused ?? 0, guarded: r?.guarded ?? 0 };
}
