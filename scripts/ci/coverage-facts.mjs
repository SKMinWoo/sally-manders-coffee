// A node:test reporter that writes the run's coverage totals as the "coverage" figure
// (server/office/facts.ts). The gate's verdict is added afterwards by coverage-gate.mjs.

export default async function* coverageFacts(source) {
  let summary = null;
  for await (const { type, data } of source) if (type === "test:coverage") summary = data.summary;
  if (!summary) throw new Error("No coverage report: run the tests with --experimental-test-coverage");
  const pct = (x) => Math.round(x * 100) / 100;
  const t = summary.totals;
  yield `${JSON.stringify({
    lines: pct(t.coveredLinePercent),
    branches: pct(t.coveredBranchPercent),
    functions: pct(t.coveredFunctionPercent),
    files: summary.files.length,
    gate: null,
  })}\n`;
}
