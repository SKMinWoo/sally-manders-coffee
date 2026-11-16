// The rule that makes a deploy zero-downtime: migrations run before the new code goes live, so for
// a minute the old code runs against the new schema. Every migration may therefore only expand it
// (add a table, a nullable column, an index, an enum value), never take away or tighten anything
// the running code relies on. A contraction ships in two deploys: the code stops using the thing
// first, then a later migration removes it, marked on its own line with
//   -- contract-ok: <why the live code no longer needs it>
// Checked by the unit tests on every pull request (expand-only.test.mjs runs it over drizzle/),
// and again by the deploy before it migrates production.
//   node scripts/ci/expand-only.mjs        exits 1, naming each statement, if any migration contracts

import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** What each contraction does to the code that's still live while the migration runs. */
const RULES = [
  [/\bDROP\s+(TABLE|VIEW|TYPE|SCHEMA|SEQUENCE|FUNCTION)\b/i, "drops what the live code may still read"],
  [/\bDROP\s+(COLUMN|CONSTRAINT\s+\S+\s+CASCADE)\b/i, "drops a column the live code may still read"],
  [/\bRENAME\b/i, "renames what the live code still asks for by its old name"],
  [/\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i, "changes a column's type under the live code"],
  [/\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i, "makes a column required that the live code may leave empty"],
  [/\b(TRUNCATE|DELETE\s+FROM)\b/i, "deletes rows the live code may be reading"],
];

/** Statements of one migration file: drizzle-kit separates them with a breakpoint comment. */
export const statements = (text) =>
  text
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * The statements in one migration that would break the code still running, each with the reason.
 * Tightening a table this same migration creates is fine: no live code has used it yet.
 */
export function contractions(text) {
  const all = statements(text);
  const created = new Set(all.flatMap((s) => [...s.matchAll(/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)].map((m) => m[1])));
  const out = [];
  for (const s of all) {
    if (/^[ \t]*--[ \t]*contract-ok:[ \t]*\S/im.test(s)) continue;
    const sql = s.replace(/^\s*--.*$/gm, "").trim();
    const table = sql.match(/^ALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?\w+"?\.)?"?(\w+)"?/i)?.[1];
    const rule = RULES.find(([re]) => re.test(sql));
    if (rule) out.push({ statement: sql, why: rule[1] });
    else if (table && !created.has(table)) {
      // a new rule on a table the live code writes to: rows it writes may now be refused
      if (/\bADD\s+(CONSTRAINT|PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY)\b/i.test(sql) && !/\bNOT\s+VALID\b/i.test(sql))
        out.push({ statement: sql, why: "adds a rule the live code's writes may break" });
      // a required column with nothing to fill it: the live code's inserts don't name it
      else if (/\bADD\s+COLUMN\b/i.test(sql) && /\bNOT\s+NULL\b/i.test(sql) && !/\bDEFAULT\b/i.test(sql))
        out.push({ statement: sql, why: "adds a required column the live code's inserts leave out" });
    }
  }
  return out;
}

/** Every migration in a folder, checked: [{ file, statement, why }]. */
export function checkFolder(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .flatMap((file) => contractions(readFileSync(`${dir}/${file}`, "utf8")).map((c) => ({ file, ...c })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const found = checkFolder(process.argv[2] ?? "drizzle");
  for (const f of found) console.log(`::error file=drizzle/${f.file}::${f.why}: ${f.statement.split("\n")[0].slice(0, 160)}`);
  if (found.length) {
    console.log(`${found.length} statement(s) would break the live site mid-deploy. Ship the code change first, then the contraction, marked -- contract-ok: <why>.`);
    process.exit(1);
  }
  console.log("Every migration only expands the schema.");
}
