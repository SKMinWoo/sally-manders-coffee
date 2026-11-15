// What a handler returns, and how it goes out: shared by every module that answers a request, so
// none of them depends on the API's routes to say "400".

import { z } from "zod";

export type ApiResult = { status: number; body: unknown; cache: "public" | "none" };

/** RFC 9457 problem details. */
export const Problem = z
  .object({ type: z.string(), title: z.string(), status: z.int(), detail: z.string().optional() })
  .meta({ id: "Problem" });

export const problem = (status: number, title: string, detail?: string): ApiResult => ({
  status,
  body: Problem.parse({ type: "about:blank", title, status, detail }),
  cache: "none",
});

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
