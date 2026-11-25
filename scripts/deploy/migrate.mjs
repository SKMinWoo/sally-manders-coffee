// Migrates production, before the new code goes live (ADR 0007). The job has already checked that
// every migration only expands the schema (scripts/ci/expand-only.mjs), so the code still serving
// keeps working against the new schema while the deploy builds.
//
// drizzle-kit applies the new migrations, the same command as `npm run db:migrate`: through Neon's
// driver, in one transaction, so a migration that fails leaves nothing half applied. Around it,
// this counts the applied migrations, so the deploy's figure says how many went out, and checks
// that the database ends up with every migration in the repository.
//   DATABASE_URL=... node scripts/deploy/migrate.mjs     writes deploy-results/migrations.json

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("::error::DATABASE_URL is not set: the production environment's secret is missing.");
  process.exit(1);
}

const sql = neon(url);

/** Migrations the database has recorded; 0 on a database that has never been migrated. */
async function applied() {
  const [t] = await sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`;
  if (!t.present) return 0;
  const [c] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
  return c.n;
}

const total = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries.length;
const before = await applied();
console.log(`${before} of ${total} migrations applied before this deploy.`);

if (before < total) {
  const run = spawnSync("npx", ["drizzle-kit", "migrate"], { stdio: "inherit", shell: process.platform === "win32" });
  if (run.status !== 0) {
    console.log("::error::drizzle-kit migrate failed; nothing was deployed, and the transaction left the schema as it was.");
    process.exit(1);
  }
}

const after = await applied();
if (after !== total) {
  console.log(`::error::The database records ${after} migrations, the repository has ${total}.`);
  process.exit(1);
}

mkdirSync("deploy-results", { recursive: true });
writeFileSync("deploy-results/migrations.json", JSON.stringify({ applied: after - before, total }));
console.log(`Applied ${after - before}; all ${total} in place.`);
