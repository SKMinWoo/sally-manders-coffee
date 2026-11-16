// Readies the load test's database: CI's Postgres, reached the way production reaches Neon, over
// HTTP through Neon's proxy (docs/decisions/0006). Waits for the proxy, applies the migrations,
// then writes a month of simulated days and yesterday's brief, as the shop has in production, and
// records the size in load-results/seed.json.
//   DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main npx tsx scripts/load/prepare.ts
// SHOP_FROZEN_AT, if set, fixes "today", so every run seeds and then reads the same shop.

import { mkdirSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db, LOCAL_NEON_HOST } from "@/server/platform/db/client";
import { orders } from "@/server/platform/db/schema";
import { now } from "@/server/platform/clock";
import { backfillDays, ensureDays } from "@/server/simulator";
import { writeBrief } from "@/server/brief";

const DAYS = 30;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  // this script fills a database with a month of made-up orders: never point it at a real one
  if (!url || new URL(url).hostname !== LOCAL_NEON_HOST) throw new Error(`DATABASE_URL must name ${LOCAL_NEON_HOST}, the load test's local database`);
  const shop = db();

  for (let i = 1; ; i++) {
    try {
      await shop.execute(sql`select 1`);
      break;
    } catch (err) {
      if (i === 30) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await migrate(shop as never, { migrationsFolder: "./drizzle" });
  const days = backfillDays(DAYS, now());
  const t = performance.now();
  const report = await ensureDays(shop, days);
  await writeBrief(shop, now()); // the template: the load test never calls the model
  const count = await shop.$count(orders);
  // what the load test reads against, for its figure (scripts/ci/load-facts.mjs)
  mkdirSync("load-results", { recursive: true });
  writeFileSync("load-results/seed.json", JSON.stringify({ days: days.length, orders: count }));
  console.log(`Seeded ${days[0]} to ${days.at(-1)}: ${report.written.length} days, ${count} orders, in ${((performance.now() - t) / 1000).toFixed(1)} s`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
