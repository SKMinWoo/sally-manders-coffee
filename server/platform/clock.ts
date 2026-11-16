// What time it is, as far as the server is concerned. One place, so the screenshot baselines can
// stop the clock: SHOP_FROZEN_AT (an ISO time) holds every page, and the simulated days the local
// database seeds itself with, at that moment, so each run renders exactly the same shop.
// Production never stops: on Vercel the setting is ignored, the way LOCAL_DB is (db/client.ts).

/**
 * The stopped time, or "" when the clock runs: for the keys of anything cached across requests.
 * Every `next start` on one build shares .next/cache, so a stopped server mustn't be handed what a
 * running one cached a minute ago (or the other way round).
 */
export const stoppedAt = (env: Record<string, string | undefined> = process.env) => (env.VERCEL ? "" : (env.SHOP_FROZEN_AT ?? ""));

export function now(env: Record<string, string | undefined> = process.env): Date {
  const at = stoppedAt(env);
  if (!at) return new Date();
  const t = Date.parse(at);
  if (Number.isNaN(t)) throw new Error(`SHOP_FROZEN_AT is not a time: ${JSON.stringify(at)}`);
  return new Date(t);
}
