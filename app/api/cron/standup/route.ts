import { shopDb } from "@/server/platform/db/client";
import { cronAuthorised } from "@/server/platform/auth";
import { now } from "@/server/platform/clock";
import { runStandup } from "@/server/board";

/**
 * The morning standup (vercel.json, 08:30 UTC, half an hour before the simulate job): measures a
 * change whose week is over, takes a regular's call about yesterday, and has the manager answer
 * and decide (server/board). A change decided on goes on the board for the first day not yet
 * written, so the simulate job writes it in. By the model when GEMINI_API_KEY is set, else the
 * templates. A second run the same morning does nothing.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorised(req.headers.get("authorization"))) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  try {
    const report = await runStandup(await shopDb(), now(), { key: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL });
    return Response.json(report);
  } catch (e) {
    console.error("[standup] failed:", e);
    return Response.json({ error: "this morning's standup didn't finish; run it again, it picks up where it stopped" }, { status: 502 });
  }
}
