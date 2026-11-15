// POST /api/ingest/ci: where CI runs on main report what they measured. The route only adapts
// this function, so the tests exercise exactly what production runs.

import { problem, type ApiResult } from "@/server/platform/http";
import type { Db } from "@/server/platform/db/client";
import { recordFacts } from "./repository";
import { bearerAuthorised } from "@/server/platform/auth";
import { IngestBody } from "./facts";

/** A run's report is a few hundred bytes; anything far bigger is not one. */
export const MAX_BODY_BYTES = 16 * 1024;

export type IngestRequest = { authorization: string | null; contentType: string | null; body: string };

export async function ingestCi(db: Db, req: IngestRequest, now: Date, secret = process.env.CI_INGEST_SECRET): Promise<ApiResult> {
  // the secret is checked before the body is even parsed, so an unauthorised caller learns nothing about the schema
  if (!bearerAuthorised(req.authorization, secret)) return problem(401, "Not authorised");
  if (!req.contentType?.startsWith("application/json")) return problem(415, "Send application/json");
  if (Buffer.byteLength(req.body) > MAX_BODY_BYTES) return problem(413, "Too large for a run's report");

  let json: unknown;
  try {
    json = JSON.parse(req.body);
  } catch {
    return problem(400, "Not JSON");
  }
  const parsed = IngestBody.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0]!;
    return problem(422, "Not a run report this shop accepts", `${first.path.join(".") || "body"}: ${first.message}`);
  }

  const stored = await recordFacts(db, parsed.data, now);
  return { status: stored ? 201 : 200, body: { stored, of: parsed.data.facts.length }, cache: "none" };
}
