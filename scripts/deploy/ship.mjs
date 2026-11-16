// Deploys main to production and proves nobody noticed (ADR 0007). Runs after the migrations.
//
//  1. Checks main still points at this run's commit. If a newer push landed, the hook would build
//     that commit before its own migrations ran, so this run stands down and the newer run ships.
//  2. Calls the Vercel deploy hook, which builds main and moves the domain onto the new build only
//     once it is ready. Until then the old build keeps serving.
//  3. Probes /api/v1/health once a second from then on. Health names the commit it was built from,
//     so the deploy is live when it answers with this one. The probe keeps going for a minute more,
//     and every request that fails or times out along the way is counted.
//  4. Smoke-tests the live site: every page and API endpoint must answer 200 with what it promises.
//
// Writes .ci/deploy.json, the "deploy" figure, which the job posts even when the smoke test fails.
//   VERCEL_DEPLOY_HOOK=... GITHUB_SHA=... node scripts/deploy/ship.mjs

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SITE = "https://sally-manders-coffee.vercel.app";
const SECOND = 1000, MINUTE = 60 * SECOND;

/** Pages must be the shop's own; API answers must be JSON. */
export const SMOKE = [
  ...["/", "/order", "/behind", "/office", "/docs"].map((path) => ({ path, html: true })),
  ...["/api/v1/health", "/api/v1/menu", "/api/v1/engineering", "/api/v1/brief", "/api/v1/openapi.json"].map((path) => ({ path, html: false })),
];

/**
 * The probe's samples ({ at, ok }, in the order they came back) as the figure: requests, how many
 * failed, and the longest wait between two good answers, which is what a visitor would have felt.
 * Failures at the start or end count toward the wait too, up to the first or last sample.
 */
export function probeStats(samples) {
  if (!samples.length) return { requests: 0, failed: 0, longestGapMs: 0 };
  let lastGood = samples[0].at, longest = 0;
  for (const s of samples) {
    if (!s.ok) continue;
    longest = Math.max(longest, s.at - lastGood);
    lastGood = s.at;
  }
  longest = Math.max(longest, samples.at(-1).at - lastGood);
  return { requests: samples.length, failed: samples.filter((s) => !s.ok).length, longestGapMs: longest };
}

/** Why one smoke answer fails, or null when it passes. */
export function smokeProblem({ html }, status, contentType, body) {
  if (status !== 200) return `answered ${status}`;
  if (html) return /text\/html/.test(contentType) && body.includes("Sally Mander") ? null : "is not the shop's page";
  try {
    JSON.parse(body);
    return null;
  } catch {
    return "is not JSON";
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, timeoutMs = 10 * SECOND) {
  const res = await fetch(`${SITE}${path}`, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store", redirect: "manual" });
  return { status: res.status, contentType: res.headers.get("content-type") ?? "", body: await res.text() };
}

async function main() {
  const { VERCEL_DEPLOY_HOOK: hook, GITHUB_SHA: sha, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY } = process.env;
  if (!hook || !/^[0-9a-f]{40}$/.test(sha ?? "")) {
    console.log("::error::VERCEL_DEPLOY_HOOK or GITHUB_SHA is not set.");
    return 1;
  }

  const head = execFileSync("git", ["ls-remote", "origin", "refs/heads/main"], { encoding: "utf8" }).split(/\s/)[0];
  if (head !== sha) {
    console.log(`::notice::main has moved on to ${head.slice(0, 7)}; its own run migrates and deploys it, so this one stands down.`);
    if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, "shipped=false\n");
    return 0;
  }

  const hookAt = Date.now();
  const res = await fetch(hook, { method: "POST" });
  if (!res.ok) {
    console.log(`::error::The deploy hook answered ${res.status}.`);
    return 1;
  }
  console.log(`Deploy hook called; waiting for ${sha.slice(0, 7)} to answer on ${SITE}.`);

  const samples = [];
  let liveAt = null, lastCommit = null;
  const deadline = hookAt + 15 * MINUTE;
  while (Date.now() < (liveAt ? liveAt + MINUTE : deadline)) {
    const start = Date.now();
    let ok = false;
    try {
      const r = await get("/api/v1/health");
      ok = r.status === 200;
      if (ok) lastCommit = JSON.parse(r.body).commit;
    } catch {
      // a timeout or a dropped connection: the visitor got nothing, so it counts as failed
    }
    samples.push({ at: Date.now(), ok });
    if (!liveAt && ok && lastCommit === sha) {
      liveAt = Date.now();
      console.log(`Live after ${Math.round((liveAt - hookAt) / SECOND)} s; probing a minute more.`);
    }
    await sleep(Math.max(0, SECOND - (Date.now() - start)));
  }
  const probe = probeStats(samples);
  if (!liveAt) {
    console.log(`::error::After 15 min the site still answers with ${lastCommit?.slice(0, 7) ?? "nothing"}. Check the deployment on Vercel, and that the hook builds main.`);
    return 1;
  }

  const problems = [];
  for (const check of SMOKE) {
    let why;
    try {
      const r = await get(check.path, 30 * SECOND);
      why = smokeProblem(check, r.status, r.contentType, r.body);
    } catch (e) {
      why = `did not answer (${e.name})`;
    }
    console.log(`${why ? "FAIL" : "ok  "} ${check.path}${why ? `: ${why}` : ""}`);
    if (why) problems.push(`${check.path} ${why}`);
  }

  const migrations = existsSync("deploy-results/migrations.json")
    ? JSON.parse(readFileSync("deploy-results/migrations.json", "utf8"))
    : { applied: 0, total: 0 };
  const fact = { migrations, liveMs: liveAt - hookAt, probe, smoke: { checks: SMOKE.length, passed: SMOKE.length - problems.length } };
  mkdirSync(".ci", { recursive: true });
  writeFileSync(".ci/deploy.json", JSON.stringify(fact, null, 2));
  if (GITHUB_OUTPUT) appendFileSync(GITHUB_OUTPUT, "shipped=true\n");
  if (GITHUB_STEP_SUMMARY)
    appendFileSync(
      GITHUB_STEP_SUMMARY,
      `### Deploy\n\n${sha.slice(0, 7)} live ${Math.round(fact.liveMs / SECOND)} s after the hook, ${migrations.applied} new migration(s). ` +
        `Probe: ${probe.failed} of ${probe.requests} requests failed, longest wait ${probe.longestGapMs} ms. ` +
        `Smoke: ${fact.smoke.passed} of ${fact.smoke.checks}.\n`,
    );

  for (const p of problems) console.log(`::error::Smoke test: ${p}`);
  if (probe.failed) console.log(`::warning::${probe.failed} probe request(s) failed during the deploy.`);
  return problems.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) process.exitCode = await main();
