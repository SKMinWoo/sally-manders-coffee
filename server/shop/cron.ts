import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries `Authorization: Bearer $CRON_SECRET`, as Vercel Cron sends it. With no
 * secret configured nothing is authorised: the job refuses rather than running open.
 */
export function cronAuthorised(header: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
