// A Playwright reporter that writes the "barcodes" figure (server/office/facts.ts) to the file it's
// given. The barcode tests (e2e/barcode.spec.ts) tally what they read as annotations, before they
// assert; this adds up each test's last attempt, across the projects (desktop and phone).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export default class BarcodeFacts {
  constructor({ outputFile }) {
    this.outputFile = outputFile;
  }

  onBegin(_config, suite) {
    this.suite = suite;
  }

  onEnd() {
    const facts = { read: 0, onPages: 0, unread: 0, misread: 0, damaged: 0, refused: 0, durationMs: 0 };
    let seen = false;
    for (const test of this.suite.allTests()) {
      const last = test.results.at(-1);
      const tallies = (last?.annotations ?? []).filter((a) => a.type === "barcodes").map((a) => JSON.parse(a.description));
      if (!tallies.length) continue;
      seen = true;
      facts.durationMs += Math.round(last.duration);
      for (const { kind, shown, right, wrong } of tallies) {
        facts.misread += wrong;
        if (kind === "damaged") {
          facts.damaged += shown;
          facts.refused += right;
        } else {
          facts.read += right;
          facts.unread += shown - right; // a misread one too: it wasn't read as what it says
          if (kind === "page") facts.onPages += right;
        }
      }
    }
    if (!seen) return; // the barcode tests didn't run (a filtered run): nothing to report
    mkdirSync(dirname(this.outputFile), { recursive: true });
    writeFileSync(this.outputFile, `${JSON.stringify(facts)}\n`);
    console.log(`Barcodes: ${JSON.stringify(facts)}`);
  }

  printsToStdio() {
    return false;
  }
}
