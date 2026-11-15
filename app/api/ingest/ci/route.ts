import { handle, respond } from "@/server/api/respond";
import { problem } from "@/server/api/v1";
import { shopDb } from "@/server/db/client";
import { ingestCi, MAX_BODY_BYTES } from "@/server/office/ingest";

/** CI runs on main post what they measured here (see server/office/facts.ts and .github/workflows/ci.yml). */
export async function POST(req: Request) {
  // refuse an oversized body before reading it; the handler checks the bytes it actually got as well
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return respond(problem(413, "Too large for a run's report"));
  const body = await req.text();
  return handle(async () =>
    ingestCi(await shopDb(), { authorization: req.headers.get("authorization"), contentType: req.headers.get("content-type"), body }, new Date()),
  );
}
