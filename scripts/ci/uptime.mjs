// The uptime figure (ADR 0007): of the last 30 days of half-hourly probes (.github/workflows/uptime.yml),
// how many found the site down. Read from GitHub's record of the probe runs, not from the site, so a
// site that was down can't fail to record it. A probe that was cancelled or never ran counts for
// neither side: GitHub sometimes drops a scheduled run, and a missing probe is not an outage.
//   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/ci/uptime.mjs    writes .ci/uptime.json

import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PROBE_TITLE = "Uptime probe";
const DAY = 24 * 60 * 60 * 1000, WINDOW_DAYS = 30;

/** The figure from the workflow's runs ({ display_title, status, conclusion, created_at }). */
export function uptimeFrom(runs, now) {
  const since = now.getTime() - WINDOW_DAYS * DAY;
  const probes = runs.filter(
    (r) => r.display_title === PROBE_TITLE && r.status === "completed" && ["success", "failure"].includes(r.conclusion) && Date.parse(r.created_at) >= since,
  );
  if (!probes.length) return null;
  const first = Math.min(...probes.map((r) => Date.parse(r.created_at)));
  return {
    days: Math.min(WINDOW_DAYS, Math.max(1, Math.ceil((now.getTime() - first) / DAY))),
    probes: probes.length,
    failed: probes.filter((r) => r.conclusion === "failure").length,
  };
}

async function main() {
  const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo } = process.env;
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString().slice(0, 10);
  const runs = [];
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/uptime.yml/runs?event=schedule&created=%3E%3D${since}&per_page=100&page=${page}`,
      { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } },
    );
    if (!res.ok) throw new Error(`GitHub answered ${res.status} for the probe runs`);
    const { workflow_runs: batch } = await res.json();
    runs.push(...batch);
    if (batch.length < 100) break;
  }
  const fact = uptimeFrom(runs, now);
  if (!fact) {
    console.log("::notice::No finished probes yet; nothing to report.");
    return;
  }
  mkdirSync(".ci", { recursive: true });
  writeFileSync(".ci/uptime.json", JSON.stringify(fact));
  console.log(`${fact.probes - fact.failed} of ${fact.probes} probes found the site up, over ${fact.days} days.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
