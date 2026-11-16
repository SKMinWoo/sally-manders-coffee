// The test gap: of the lines a change touched, which ones no test ran. It reads the coverage the
// unit tests just wrote (.ci/lcov.info) against `git diff` from the base, over the code coverage
// counts (lib/ and server/, the tests themselves aside), and writes:
//
//   - .ci/test-gap.json, the figure /office shows (posted on main only, like every other figure);
//   - test-gap/comment.md, which the pull request's test-gap job posts as one comment, kept current;
//   - and a table in the run's summary.
//
// Node's coverage marks a line run when the code around it ran, comments included, so a line
// counted here as not run sits in a function, a branch or a file no test reached. It names lines
// rather than failing the build: a gap is for the author to read, not a gate.
//
// BASE_SHA is the commit before the change: `HEAD^1` on a pull request, whose checkout is GitHub's
// merge commit, and the push's `before` on main. HEAD_URL_SHA is the commit the links point at.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const { BASE_SHA: base, HEAD_URL_SHA: linkSha, GITHUB_SERVER_URL: server = "https://github.com", GITHUB_REPOSITORY: repo, GITHUB_STEP_SUMMARY: summary } = process.env;

// a new branch's first push has no before (all zeros); nothing to compare, so nothing is measured
if (!base || /^0+$/.test(base)) {
  console.log("::notice::No commit to compare with, so no test gap was measured.");
  process.exit(0);
}
if (!/^(?:[0-9a-f]{40}|HEAD\^1)$/.test(base)) throw new Error(`BASE_SHA isn't a commit: ${JSON.stringify(base)}`);
if (linkSha && !/^[0-9a-f]{40}$/.test(linkSha)) throw new Error("HEAD_URL_SHA isn't a commit");

/** The files coverage counts, the same globs as `npm run test:ci`. */
const counted = (f) => /^(?:lib|server)\/.+\.ts$/.test(f) && !f.endsWith(".test.ts") && f !== "server/platform/db/test-db.ts";

/** Each counted file the change touched, and the line numbers it added or changed there. */
function changedLines() {
  // execFile, not a shell: nothing here is ever parsed as a command
  const diff = execFileSync("git", ["diff", "--unified=0", "--no-color", "--no-ext-diff", "--diff-filter=AMR", base, "HEAD", "--", "lib", "server"], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
  const out = new Map();
  let file = null;
  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const p = line.slice(4);
      file = p.startsWith("b/") && counted(p.slice(2)) ? p.slice(2) : null;
      if (file) out.set(file, new Set());
      continue;
    }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (h && file) for (let i = 0, n = h[2] === undefined ? 1 : Number(h[2]); i < n; i++) out.get(file).add(Number(h[1]) + i);
  }
  return out;
}

/** Each file's lines that coverage knows of, and how many times each ran. */
function coverage(path) {
  const out = new Map();
  let lines = null;
  for (const row of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (row.startsWith("SF:")) out.set(row.slice(3).replaceAll("\\", "/"), (lines = new Map()));
    else if (row.startsWith("DA:") && lines) {
      const [n, hits] = row.slice(3).split(",");
      lines.set(Number(n), Number(hits));
    }
  }
  return out;
}

/** [3, 4, 5, 9] → "3–5, 9", each a link to those lines at the commit. */
function ranges(file, lines) {
  const runs = [];
  for (const n of lines) {
    const last = runs.at(-1);
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  const at = linkSha && repo ? `${server}/${repo}/blob/${linkSha}/${file}` : null;
  return runs
    .map(([a, b]) => {
      const text = a === b ? `${a}` : `${a}–${b}`;
      return at ? `[${text}](${at}#L${a}${a === b ? "" : `-L${b}`})` : text;
    })
    .join(", ");
}

if (!existsSync(".ci/lcov.info")) throw new Error("No .ci/lcov.info: run `npm run test:ci` first");
const cov = coverage(".ci/lcov.info");
const changed = changedLines();

let lines = 0, uncovered = 0;
const gaps = [], unknown = [];
for (const [file, set] of changed) {
  const hits = cov.get(file);
  if (!hits) {
    if (set.size) unknown.push(file); // every-module.test.ts loads every file, so this is a surprise worth saying
    continue;
  }
  const runnable = [...set].filter((n) => hits.has(n)).sort((a, b) => a - b);
  const missed = runnable.filter((n) => hits.get(n) === 0);
  lines += runnable.length;
  uncovered += missed.length;
  if (missed.length) gaps.push({ file, missed });
}
const files = [...changed.keys()].filter((f) => cov.has(f)).length;

mkdirSync(".ci", { recursive: true });
writeFileSync(".ci/test-gap.json", JSON.stringify({ changed: lines, uncovered, files }));

const MAX_ROWS = 30;
const md = [
  "<!-- test-gap -->",
  "### Test gap",
  "",
  !lines
    ? "This change touches no line in `lib/` or `server/` that runs, so there's nothing for a test to cover."
    : uncovered
      ? `Of the ${lines} changed lines in \`lib/\` and \`server/\` that run, **${uncovered}** ran under no test, in ${gaps.length} ${gaps.length === 1 ? "file" : "files"}:`
      : `Every one of the ${lines} changed lines in \`lib/\` and \`server/\` that run was run by a test.`,
];
if (gaps.length) {
  md.push("", "| File | Lines no test ran |", "|---|---|");
  for (const g of gaps.slice(0, MAX_ROWS)) md.push(`| \`${g.file}\` | ${ranges(g.file, g.missed)} |`);
  if (gaps.length > MAX_ROWS) md.push(`| … and ${gaps.length - MAX_ROWS} more | |`);
}
if (unknown.length) md.push("", `Not in the coverage report at all: ${unknown.map((f) => `\`${f}\``).join(", ")}.`);
md.push("", "<sub>From the unit tests' coverage against the diff (`scripts/ci/test-gap.mjs`). It names lines; it doesn't fail the build.</sub>", "");

mkdirSync("test-gap", { recursive: true });
writeFileSync("test-gap/comment.md", md.join("\n"));
if (summary) appendFileSync(summary, md.slice(1).join("\n"));
console.log(`Test gap: ${uncovered} of ${lines} changed lines that run, in ${files} files, ran under no test.`);
