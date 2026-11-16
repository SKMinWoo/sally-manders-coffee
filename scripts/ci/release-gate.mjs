// The release gate's verdict over the run's gates (.github/workflows/ci.yml passes each step's
// outcome in GATES, as [name, outcome] pairs). It writes the "quality-gates" figure
// (server/office/facts.ts) to .ci/quality-gates.json, a table to the run's summary, and fails when
// any gate failed. A gate skipped because it isn't set up (SonarCloud without its token) doesn't
// hold a release; one skipped because an earlier gate failed never matters, since that one did.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const gates = JSON.parse(process.env.GATES ?? "[]").map(([name, outcome]) => ({ name, outcome: outcome || "skipped" }));
if (!gates.length) throw new Error("GATES is empty: the workflow passes every gate's outcome");
const passed = gates.every((g) => g.outcome === "success" || g.outcome === "skipped") && gates.some((g) => g.outcome === "success");
const baselines = existsSync(".ci/baselines.json") ? JSON.parse(readFileSync(".ci/baselines.json", "utf8")) : null;
const started = Number(process.env.GATE_STARTED_MS);
const durationMs = Number.isFinite(started) && started > 0 ? Math.max(0, Date.now() - started) : 0;

const facts = { passed, gates, baselines, durationMs };
mkdirSync(".ci", { recursive: true });
writeFileSync(".ci/quality-gates.json", `${JSON.stringify(facts)}\n`);

const mark = { success: "passed", failure: "**failed**", skipped: "skipped", cancelled: "cancelled" };
const summary = [
  `### Release gate: ${passed ? "open" : "**held**"}`,
  "",
  "| Gate | Result |",
  "| --- | --- |",
  ...gates.map((g) => `| ${g.name} | ${mark[g.outcome] ?? g.outcome} |`),
  "",
  baselines ? `Screenshot baselines: ${baselines.matched} of ${baselines.compared} matched.` : "Screenshot baselines: didn't run.",
  `Checkout to verdict: ${Math.round(durationMs / 1000)} s.`,
  "",
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
console.log(summary);
if (!passed) process.exitCode = 1;
