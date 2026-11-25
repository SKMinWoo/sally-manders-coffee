// The cluster's seed Job (deploy/chart/templates/seed-job.yaml): readies the in-cluster Postgres the
// way production's Neon is readied. It waits for Neon's proxy, applies the migrations, then writes
// the last week, today and tomorrow, and yesterday's brief. Until today and tomorrow are written,
// health says "degraded", so Argo CD syncs this before the shop starts (ADR 0008).
//   DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main \
//   LOCAL_NEON_ENDPOINT=http://neon-proxy:4444/sql node --import tsx scripts/cluster/seed.ts

import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { db, LOCAL_NEON_HOST } from "@/server/platform/db/client";
import { orders } from "@/server/platform/db/schema";
import { now } from "@/server/platform/clock";
import { backfillDays, daysAhead, ensureDays } from "@/server/simulator";
import { writeBrief } from "@/server/brief";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  // this fills a database with made-up orders: never point it at a real one
  if (!url || new URL(url).hostname !== LOCAL_NEON_HOST) throw new Error(`DATABASE_URL must name ${LOCAL_NEON_HOST}, the cluster's own database`);
  const shop = db();

  for (let i = 1; ; i++) {
    try {
      await shop.execute(sql`select 1`);
      break;
    } catch (err) {
      if (i === 60) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await migrate(shop as never, { migrationsFolder: "./drizzle" });
  // a week back, so week-over-week has something to compare, and a day more for yesterday's brief
  const days = [...new Set([...backfillDays(8, now()), ...daysAhead(now())])];
  const report = await ensureDays(shop, days);
  await writeBrief(shop, now()); // the template: the cluster never calls the model
  console.log(`Seeded ${days[0]} to ${days.at(-1)}: ${report.written.length} days written, ${await shop.$count(orders)} orders`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
