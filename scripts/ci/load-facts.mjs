// Turns JMeter's results (one CSV row per request, load/shop.jmx) into the "load-test" figure for
// /office: requests, errors, and the P50/P95/P99 of each endpoint, slowest first. Also writes the
// table to the run's summary. Not a gate: the figures are posted as measured, slow or not.
//   RESULTS=load-results/results.jtl SEED=load-results/seed.json USERS=20 PER_MINUTE=6000 node scripts/ci/load-facts.mjs

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * A CSV file into records of fields, honouring JMeter's quoting ("a, b" and "" for a quote). A
 * quoted field may run over several lines, as a failed assertion's message does, so the file is
 * read as one stream rather than split into lines first.
 */
export function csvRecords(text) {
  const records = [];
  let row = [], cur = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      records.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) records.push([...row, cur]);
  return records.filter((r) => r.length > 1 || r[0] !== "");
}

/** One CSV line into fields. */
export const csvFields = (line) => csvRecords(line)[0] ?? [""];

/** The p-th percentile by nearest rank: the smallest value that p% of the samples are at or under. */
export function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length, Math.max(1, Math.ceil((p / 100) * sorted.length))) - 1];
}

/** The rows of a JMeter CSV results file, as { at, ms, label, ok }. */
export function readSamples(text) {
  const [head = [], ...rows] = csvRecords(text);
  const col = (name) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`The results have no "${name}" column (found: ${head.join(", ")})`);
    return i;
  };
  const [at, ms, label, ok] = [col("timeStamp"), col("elapsed"), col("label"), col("success")];
  return rows.map((f, n) => {
    // a short row would be read as an unnamed endpoint; say which one instead
    if (f.length !== head.length) throw new Error(`Result ${n + 1} has ${f.length} fields, the header ${head.length}: ${f.join(",").slice(0, 120)}`);
    return { at: Number(f[at]), ms: Number(f[ms]), label: f[label], ok: f[ok] === "true" };
  });
}

const stats = (samples) => {
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  return {
    requests: samples.length,
    errors: samples.filter((s) => !s.ok).length,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
    maxMs: sorted.at(-1) ?? 0,
  };
};

/** The figure: the whole run, then each endpoint, slowest at P95 first (ties by name). */
export function summarise(samples, { users, perMinute, seed }) {
  if (!samples.length) throw new Error("JMeter recorded no requests");
  const by = Map.groupBy(samples, (s) => s.label);
  const endpoints = [...by].map(([name, ss]) => ({ name, ...stats(ss) }));
  endpoints.sort((a, b) => b.p95Ms - a.p95Ms || a.name.localeCompare(b.name));
  const all = stats(samples);
  const start = Math.min(...samples.map((s) => s.at));
  const end = Math.max(...samples.map((s) => s.at + s.ms));
  return {
    requests: all.requests,
    errors: all.errors,
    durationMs: end - start,
    users,
    perMinute,
    p95Ms: all.p95Ms,
    p99Ms: all.p99Ms,
    seed,
    endpoints,
  };
}

function summary(f) {
  const rate = (f.requests / (f.durationMs / 1000)).toFixed(1);
  const rows = f.endpoints.map((e) => `| \`${e.name}\` | ${e.requests} | ${e.errors} | ${e.p50Ms} | **${e.p95Ms}** | ${e.p99Ms} | ${e.maxMs} |`);
  return [
    "### Load test",
    "",
    `${f.requests.toLocaleString("en-US")} requests from ${f.users} visitors in ${(f.durationMs / 1000).toFixed(0)} s (${rate}/s, paced to ${f.perMinute / 60}/s), ` +
      `${f.errors} errors, against ${f.seed.orders.toLocaleString("en-US")} orders over ${f.seed.days} days. P95 ${f.p95Ms} ms, P99 ${f.p99Ms} ms.`,
    "",
    "| Endpoint | Requests | Errors | P50 ms | P95 ms | P99 ms | Max ms |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...rows,
    "",
  ].join("\n");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const env = process.env;
  const samples = readSamples(readFileSync(env.RESULTS ?? "load-results/results.jtl", "utf8"));
  const seed = JSON.parse(readFileSync(env.SEED ?? "load-results/seed.json", "utf8"));
  const fact = summarise(samples, { users: Number(env.USERS), perMinute: Number(env.PER_MINUTE), seed });
  mkdirSync(".ci", { recursive: true });
  writeFileSync(".ci/load-test.json", JSON.stringify(fact, null, 2));
  const md = summary(fact);
  console.log(md);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, md);
}
