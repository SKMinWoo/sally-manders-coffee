import { test } from "node:test";
import assert from "node:assert/strict";
import { localDbDir, localNeonEndpoint } from "./client";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;
const NEON = "postgres://someone@somewhere.neon.tech/neondb";

test("a folder asked for by name wins over DATABASE_URL, so the browser tests never reach Neon", () => {
  assert.equal(localDbDir(env({ LOCAL_DB: ".pglite-e2e", DATABASE_URL: NEON, NODE_ENV: "production" })), ".pglite-e2e");
});

test("Vercel always gets Neon, even if LOCAL_DB is set there by mistake", () => {
  assert.equal(localDbDir(env({ VERCEL: "1", LOCAL_DB: ".pglite-e2e", DATABASE_URL: NEON })), null);
});

test("otherwise DATABASE_URL means Neon, and development without one gets .pglite/", () => {
  assert.equal(localDbDir(env({ DATABASE_URL: NEON, NODE_ENV: "development" })), null);
  assert.equal(localDbDir(env({ NODE_ENV: "development" })), "./.pglite");
  assert.equal(localDbDir(env({ NODE_ENV: "production" })), null, "a production build with no database is an error, not a quiet PGlite");
});

test("only the load test's local host is sent to the proxy over plain HTTP; Neon keeps the driver's endpoint", () => {
  assert.equal(localNeonEndpoint("postgres://postgres:postgres@db.localtest.me:5432/main", env({})), "http://db.localtest.me:4444/sql");
  assert.equal(localNeonEndpoint(NEON, env({})), null);
  assert.equal(localNeonEndpoint("postgres://u:p@db.localtest.me.evil.example/x", env({})), null, "the whole host name, not a prefix");
  assert.equal(localNeonEndpoint("postgres://postgres:postgres@db.localtest.me:5432/main", env({ VERCEL: "1" })), null, "never on Vercel");
});

test("the cluster names its proxy's address, but only for the local host name", () => {
  const cluster = env({ LOCAL_NEON_ENDPOINT: "http://neon-proxy:4444/sql" });
  assert.equal(localNeonEndpoint("postgres://postgres:postgres@db.localtest.me:5432/main", cluster), "http://neon-proxy:4444/sql");
  assert.equal(localNeonEndpoint(NEON, cluster), null, "a real Neon URL never goes to the override");
  assert.equal(localNeonEndpoint("postgres://postgres:postgres@db.localtest.me:5432/main", env({ ...cluster, VERCEL: "1" })), null);
});
