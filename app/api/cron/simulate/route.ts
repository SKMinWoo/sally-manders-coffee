import { shopDb } from "@/server/platform/db/client";
import { cronAuthorised } from "@/server/platform/auth";
import { daysAhead, ensureDays } from "@/server/simulator";
import { writeBrief, type WriteResult } from "@/server/brief";
import { now } from "@/server/platform/clock";

/**
 * The daily job (vercel.json, 09:00 UTC, which is 3 or 4 am in Austin): writes today and tomorrow
 * if either is missing, so one missed run leaves no gap. Days already written are left alone, so
 * running it twice does nothing the second time. Then, with yesterday over, it writes the
 * manager's brief on it (server/brief): by the model when GEMINI_API_KEY is set, else the template.
 * A brief that fails is logged and leaves the days' report standing.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorised(req.headers.get("authorization"))) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  const db = await shopDb();
  let report;
  try {
    report = await ensureDays(db, daysAhead(now()));
  } catch (e) {
    console.error("[simulate] failed:", e);
    return Response.json({ error: "the simulator failed; the days already written stay up" }, { status: 502 });
  }
  let brief: WriteResult | { error: string };
  try {
    brief = await writeBrief(db, now(), { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL });
  } catch (e) {
    console.error("[brief] failed:", e);
    brief = { error: "yesterday's brief wasn't written; the days were" };
  }
  return Response.json({ ...report, brief });
}
