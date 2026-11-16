// The manager's brief: a short note on yesterday, written by a model or a template, and kept only
// if every number in it is the database's (the guard). Depends on reporting for the day's figures.

import { unstable_cache } from "next/cache";
import { shopDb } from "@/server/platform/db/client";
import { stoppedAt } from "@/server/platform/clock";
import { latestBrief } from "./repository";

export { dayFigures, type BriefFigure } from "./figures";
export { guard, parts, type Verdict } from "./guard";
export { briefCounts, latestBrief, type Brief, type BriefCounts } from "./repository";
export { template, writeBrief, type BriefConfig, type WriteResult } from "./write";

/** The newest brief, cached five minutes: it changes once a day. */
export const getLatestBrief = unstable_cache(async () => latestBrief(await shopDb()), ["brief", stoppedAt()], { revalidate: 300 });
