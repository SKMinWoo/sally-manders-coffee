// A Playwright reporter that counts the screenshot baselines (e2e/visual.spec.ts) for the release
// gate (scripts/ci/release-gate.mjs): how many pictures were compared, across the projects, and how
// many matched on their last attempt. Writes nothing if the baselines didn't run.

import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";

export default class BaselineFacts {
  constructor({ outputFile }) {
    this.outputFile = outputFile;
  }

  onBegin(_config, suite) {
    this.suite = suite;
  }

  onEnd() {
    const runs = this.suite.allTests().filter((t) => basename(t.location.file) === "visual.spec.ts");
    if (!runs.length) return;
    const facts = {
      compared: runs.filter((t) => t.outcome() !== "skipped").length,
      matched: runs.filter((t) => t.outcome() === "expected" || t.outcome() === "flaky").length,
    };
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, `${JSON.stringify(facts)}\n`);
    console.log(`Baselines: ${JSON.stringify(facts)}`);
  }

  printsToStdio() {
    return false;
  }
}
