import { shopDb } from "@/server/platform/db/client";
import { cronAuthorised } from "@/server/platform/auth";
import { daysAhead, ensureDays } from "@/server/simulator";

/**
 * The daily job (vercel.json, 09:00 UTC, which is 3 or 4 am in Austin): writes today and tomorrow
 * if either is missing, so one missed run leaves no gap. Days already written are left alone, so
 * running it twice does nothing the second time.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorised(req.headers.get("authorization"))) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  try {
    const report = await ensureDays(await shopDb(), daysAhead(new Date()));
    return Response.json(report);
  } catch (e) {
    console.error("[simulate] failed:", e);
    return Response.json({ error: "the simulator failed; the days already written stay up" }, { status: 502 });
  }
}
