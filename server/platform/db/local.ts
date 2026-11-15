// When DATABASE_URL is not set, `npm run dev` gets a real Postgres anyway. PGlite (Postgres in
// WebAssembly, the same one the tests use) keeps its files in .pglite/, so a fresh clone runs with
// no Neon account and no setup, and the seeded week survives restarts. The browser tests use it
// too, in a folder of their own (LOCAL_DB). Production on Vercel never comes here: see localDbDir().

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { shopToday } from "@/lib/time";
import { backfillDays, daysAhead, ensureDays } from "@/server/simulator";
import type { Db } from "./client";
import * as schema from "./schema";

// Kept on globalThis so hot reloads reuse the one open database instead of opening it again.
const g = globalThis as unknown as { __sallyLocal?: Promise<Db>; __sallySeeded?: string };

async function open(dir: string): Promise<Db> {
  const pg = drizzle({ client: new PGlite(dir), schema, casing: "snake_case" });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  const db = pg as unknown as Db;
  await ensureDays(db, backfillDays(7)); // a week back, so week-over-week has something to compare
  return db;
}

export async function localDb(dir: string): Promise<Db> {
  g.__sallyLocal ??= open(dir);
  const db = await g.__sallyLocal;
  // a dev server left running past midnight in Austin: write the new day and the one after
  const today = shopToday();
  if (g.__sallySeeded !== today) {
    await ensureDays(db, daysAhead());
    g.__sallySeeded = today;
  }
  return db;
}
