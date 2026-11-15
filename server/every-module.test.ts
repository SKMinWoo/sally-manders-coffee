import { test } from "node:test";
import assert from "node:assert/strict";
import { globSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Coverage only counts the files a test loads, so a module no test touches would be left out and
// the figure would flatter the code. Loading every module once brings the untested ones in at their
// true, low number, the way `c8 --all` does. It also catches a module that throws on import.
const MODULES = globSync(["lib/**/*.ts", "server/**/*.ts"]).filter((f) => !f.endsWith(".test.ts") && !/test-db\.ts$/.test(f));

test("every module in lib/ and server/ loads, so coverage counts all of them", async () => {
  assert.ok(MODULES.length >= 25, `found ${MODULES.length} modules; is the glob right?`);
  for (const f of MODULES) await import(pathToFileURL(resolve(f)).href);
});
