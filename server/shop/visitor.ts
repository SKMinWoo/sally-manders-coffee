import { createHmac } from "node:crypto";

/**
 * Who a visitor is, for the rate limit and nothing else: an HMAC of their IP under IP_HASH_SALT.
 * The IP is never stored or logged, and the hash can't be reversed without the salt, which lives
 * only in the server's environment. Development without a salt uses a fixed one.
 */
export function visitorHashOf(ip: string): string {
  const salt = process.env.IP_HASH_SALT || (process.env.NODE_ENV === "production" ? "" : "development only");
  if (!salt) throw new Error("IP_HASH_SALT is not set (see .env.example)");
  return createHmac("sha256", salt).update(ip).digest("base64url");
}

/** The client's IP as Vercel reports it. Vercel sets these headers itself, so a client can't forge them. */
export function clientIp(h: Headers): string {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
