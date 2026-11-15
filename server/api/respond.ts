import type { ApiResult } from "./v1";
import { problem } from "./v1";

const CACHE = {
  // a minute fresh at Vercel's edge, then served stale for five more while one request refreshes it
  public: "public, s-maxage=60, stale-while-revalidate=300",
  none: "no-store",
} as const;

/** An ApiResult as a Response: JSON, or problem+json for errors, with the cache policy. */
export function respond(r: ApiResult): Response {
  return new Response(JSON.stringify(r.body), {
    status: r.status,
    headers: {
      "Content-Type": r.status >= 400 ? "application/problem+json" : "application/json",
      "Cache-Control": CACHE[r.cache],
      "Access-Control-Allow-Origin": "*", // read-only and public: the résumé site reads it from the browser too
    },
  });
}

/** Runs a handler; anything it throws becomes a 500 problem, never a stack trace. */
export async function handle(fn: () => Promise<ApiResult>): Promise<Response> {
  try {
    return respond(await fn());
  } catch (err) {
    console.error("api error", err);
    return respond(problem(500, "Something went wrong at the counter"));
  }
}
