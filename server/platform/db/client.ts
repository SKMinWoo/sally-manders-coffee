import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * Any Drizzle Postgres database with this schema: Neon over HTTP in the app, PGlite in tests.
 * Repository functions take one of these, so the same code runs against both. Neither path
 * relies on interactive transactions, which Neon's HTTP driver does not have.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let cached: Db | undefined;

/**
 * Where a local PGlite keeps its files, or null for Neon. Vercel never gets a local database,
 * whatever its environment says. LOCAL_DB names a folder and beats DATABASE_URL: the browser tests
 * start `next start` with one, and `next start` also reads .env.local, which may well hold the
 * production URL. (It did, and the first runs of the browser tests put their orders on the live
 * rail.) Development without either gets .pglite/.
 */
export function localDbDir(env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.VERCEL) return null;
  if (env.LOCAL_DB) return env.LOCAL_DB;
  if (env.DATABASE_URL) return null;
  return env.NODE_ENV === "production" ? null : "./.pglite";
}

/**
 * The database the app reads: Neon when DATABASE_URL is set, otherwise (see localDbDir) a local
 * PGlite seeded with a week of simulated days (./local.ts).
 */
export async function shopDb(): Promise<Db> {
  const dir = localDbDir();
  if (!dir) return db();
  const { localDb } = await import("./local");
  return localDb(dir);
}

/** The shop's database, from DATABASE_URL. Created on first use, so builds don't need it. */
export function db(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  cached = drizzle({ client: neon(url), schema, casing: "snake_case" }) as unknown as Db;
  return cached;
}
