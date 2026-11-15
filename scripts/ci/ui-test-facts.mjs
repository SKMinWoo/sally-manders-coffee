// A Playwright reporter that writes the "ui-tests" figure (server/office/facts.ts) to the file it's
// given: how many browser tests there are, how many runs that made across the projects (desktop
// and phone), and how each run ended. A run that failed once and passed on its retry is flaky,
// counted apart from the ones that passed first time.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export default class UiTestFacts {
  constructor({ outputFile }) {
    this.outputFile = outputFile;
  }

  onBegin(config, suite) {
    this.projects = config.projects.map((p) => p.name);
    this.suite = suite;
  }

  onEnd(result) {
    const runs = this.suite.allTests();
    const outcome = (o) => runs.filter((t) => t.outcome() === o).length;
    const facts = {
      tests: new Set(runs.map((t) => t.titlePath().slice(2).join(" › "))).size,
      projects: this.projects,
      runs: runs.length,
      passed: outcome("expected"),
      flaky: outcome("flaky"),
      failed: outcome("unexpected"),
      skipped: outcome("skipped"),
      durationMs: Math.round(result.duration),
    };
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, `${JSON.stringify(facts)}\n`);
    console.log(`UI tests: ${JSON.stringify(facts)}`);
  }

  printsToStdio() {
    return false;
  }
}
