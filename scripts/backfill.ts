// Seeds the shop's history once, so week-over-week figures work on day one.
//   npm run sim:backfill -- --days 28
// Safe to run again: days already written are skipped.

import { parseArgs } from "node:util";
import { db } from "@/server/platform/db/client";
import { backfillDays, ensureDays } from "@/server/simulator";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local: DATABASE_URL must come from the environment
}

const { values } = parseArgs({ options: { days: { type: "string", default: "28" } } });
const n = Number(values.days);
if (!Number.isInteger(n) || n < 0 || n > 366) {
  console.error(`--days must be a whole number from 0 to 366, not "${values.days}"`);
  process.exit(1);
}

// A function rather than top-level await: package.json has no "type": "module", so tsx runs this as CommonJS.
async function main() {
  const days = backfillDays(n);
  console.log(`Backfilling ${days[0]} to ${days.at(-1)} (${days.length} days)…`);
  const report = await ensureDays(db(), days);
  console.log(`written ${report.written.length}, already there ${report.already.length}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
