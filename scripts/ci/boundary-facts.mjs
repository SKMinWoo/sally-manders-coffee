// Writes .ci/boundaries.json, the "boundaries" figure: how many imports in the repository cross from
// one area into a domain module, and how many of them break the rules in eslint-rules/boundaries.mjs.
// It applies the lint rule's own check() to every import of every tracked source file, so this count
// and `npm run lint` can't disagree. Lint fails the build on a breach; this reports what it checked.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { check, MODULES, moduleOf, resolve, undeclared, areaOf } from "../../eslint-rules/boundaries.mjs";

const files = execFileSync("git", ["ls-files", "app", "components", "lib", "scripts", "server"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => /\.(?:tsx?|mjs)$/.test(f) && !f.endsWith(".d.mts"));

let imports = 0;
let crossings = 0;
const violations = [];
const uses = new Set();

for (const file of files) {
  const folder = undeclared(file);
  if (folder) violations.push(`${file}: ${folder}/ is not a declared module`);
  const from = areaOf(file).module;
  for (const { fileName: spec } of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
    imports++;
    const to = moduleOf(resolve(file, spec));
    if (to && to !== from) {
      crossings++;
      if (from && !areaOf(file).edge) uses.add(`${from}→${to}`);
    }
    const breach = check(file, spec);
    if (breach) violations.push(`${file} → ${spec}: ${breach.kind}`);
  }
}

const boundaries = {
  modules: Object.keys(MODULES).length,
  publicEntries: Object.keys(MODULES).filter((m) => existsSync(`server/${m}/index.ts`)).length,
  files: files.length,
  imports,
  crossings,
  violations: violations.length,
  uses: [...uses].sort(),
  decisions: readdirSync("docs/decisions").filter((f) => /^\d{4}-.+\.md$/.test(f)).length,
};

mkdirSync(".ci", { recursive: true });
writeFileSync(".ci/boundaries.json", `${JSON.stringify(boundaries)}\n`);
console.log(`Boundaries: ${JSON.stringify(boundaries)}`);
for (const v of violations) console.log(`  breach: ${v}`);
