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

/** The shop's database, from DATABASE_URL. Created on first use, so builds don't need it. */
export function db(): Db {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  cached = drizzle({ client: neon(url), schema, casing: "snake_case" }) as unknown as Db;
  return cached;
}
