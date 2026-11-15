// A node:test reporter that counts results and writes one JSON object, the "unit-tests" figure
// CI posts to the back office (server/office/facts.ts). It runs beside the usual spec reporter.

export default async function* testFacts(source) {
  let passed = 0, failed = 0, skipped = 0, durationMs = 0;
  for await (const { type, data } of source) {
    const isTest = data?.details?.type !== "suite";
    if (type === "test:pass" && isTest) {
      if (data.skip || data.todo) skipped++;
      else passed++;
    }
    if (type === "test:fail" && isTest) failed++;
    // the run's own summary comes last and carries no file; per-file summaries do
    if (type === "test:summary" && !data.file) durationMs = Math.round(data.duration_ms);
  }
  yield `${JSON.stringify({ passed, failed, skipped, durationMs })}\n`;
}
