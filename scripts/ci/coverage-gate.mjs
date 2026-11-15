// Applies the bar in coverage-bar.mjs to this run's coverage and fails the job below it.
// It also writes the verdict into .ci/coverage.json, so /office shows the rule and the result.

import { readFile, writeFile } from "node:fs/promises";
import { bar } from "./coverage-bar.mjs";

const PATH = ".ci/coverage.json";
const c = JSON.parse(await readFile(PATH, "utf8"));
const gate = bar(c);
const wellFormed = (g) => typeof g.rule === "string" && g.rule.length > 0 && g.rule.length <= 120 && typeof g.passed === "boolean";
if (gate && !wellFormed(gate)) {
  throw new Error(`coverage-bar.mjs must return { rule: string (1 to 120 characters), passed: boolean } or null; got ${JSON.stringify(gate)}`);
}
await writeFile(PATH, `${JSON.stringify({ ...c, gate })}\n`);

const figures = `lines ${c.lines}%, branches ${c.branches}%, functions ${c.functions}%, over ${c.files} modules`;
if (!gate) console.log(`::notice::No coverage bar set yet (${figures}).`);
else if (gate.passed) console.log(`Coverage gate passed: ${gate.rule} (${figures}).`);
else {
  console.log(`::error::Coverage gate failed: ${gate.rule} (${figures}).`);
  process.exitCode = 1;
}
