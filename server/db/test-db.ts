// A real Postgres for tests: PGlite runs Postgres compiled to WebAssembly inside the test
// process, so the database tests need no server, no Docker and no network, on Windows or in CI.
// Each call gets a fresh, empty database with every migration applied.

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./client";
import * as schema from "./schema";

export async function testDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const client = new PGlite();
  const pg = drizzle({ client, schema, casing: "snake_case" });
  await migrate(pg, { migrationsFolder: "./drizzle" });
  return { db: pg as unknown as Db, close: () => client.close() };
}
