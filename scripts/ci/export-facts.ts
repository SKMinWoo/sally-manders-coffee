// Writes .ci/export.json, the "export" figure: the sales export streamed from a 90-day simulated
// history (past GM's 20,000 rows) and from a 14-day one, timed, its live heap sampled at every chunk,
// and each workbook opened again and checked against its own Totals sheet. If streaming works,
// the live heap stays within about one page of rows (PAGE, 2,000), however many pages there are.
// A workbook that fails its check fails CI.
//
// Run with: node --expose-gc --import tsx scripts/ci/export-facts.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { addDays } from "@/lib/time";
import { testDb } from "@/server/platform/db/test-db";
import { checkSalesWorkbook } from "@/server/reporting";
import { exportSales } from "@/server/reporting";
import { ensureDays } from "@/server/simulator";

const LAST = "2026-10-29"; // a fixed span, so the row counts are the same on every run
const NOW = new Date(`${addDays(LAST, 1)}T17:00:00Z`);
const gc = (globalThis as { gc?: () => void }).gc;
const mb = (b: number) => Math.round((b / 1_048_576) * 10) / 10;

async function measure(db: Awaited<ReturnType<typeof testDb>>["db"], days: number) {
  const r = await exportSales(db, { from: addDays(LAST, 1 - days), to: LAST, ifNoneMatch: null }, NOW);
  if (r.kind !== "workbook") throw new Error(`Expected a workbook, got ${r.kind}`);
  gc?.();
  const base = process.memoryUsage().heapUsed;
  let peak = base, bytes = 0;
  const parts: Buffer[] = [];
  const t0 = performance.now();
  for await (const chunk of r.body()) {
    bytes += chunk.length;
    // live memory, not garbage waiting to be swept: what a long export could actually run out of
    gc!();
    peak = Math.max(peak, process.memoryUsage().heapUsed);
    parts.push(Buffer.from(chunk)); // kept to check afterwards; a Buffer's bytes live outside the JS heap
  }
  const durationMs = Math.round(performance.now() - t0);
  const check = checkSalesWorkbook(Buffer.concat(parts));
  if (check.problems.length) throw new Error(`The ${days}-day workbook failed its check:\n${check.problems.join("\n")}`);
  if (check.rows !== r.stats.lines) throw new Error(`${check.rows} rows, the span has ${r.stats.lines} lines`);
  return { days, rows: check.rows, bytes, durationMs, heapPeakMb: mb(peak - base) };
}

async function main() {
  if (!gc) throw new Error("Run with --expose-gc so the heap is measured from a clean start");
  const { db, close } = await testDb();
  try {
    await ensureDays(db, Array.from({ length: 90 }, (_, i) => addDays(LAST, i - 89)));
    const small = await measure(db, 14); // two full pages: a shorter span would understate a page's cost
    const big = await measure(db, 90);
    const fact = { ...big, baseline: { days: small.days, rows: small.rows, heapPeakMb: small.heapPeakMb } };
    mkdirSync(".ci", { recursive: true });
    writeFileSync(".ci/export.json", JSON.stringify(fact));
    console.log(JSON.stringify(fact));
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
