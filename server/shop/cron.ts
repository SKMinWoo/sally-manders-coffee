import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries `Authorization: Bearer <secret>`, compared in constant time. With no
 * secret configured nothing is authorised: the endpoint refuses rather than running open.
 */
export function bearerAuthorised(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The daily job's check: `Authorization: Bearer $CRON_SECRET`, as Vercel Cron sends it. */
export const cronAuthorised = (header: string | null, secret = process.env.CRON_SECRET) => bearerAuthorised(header, secret);
