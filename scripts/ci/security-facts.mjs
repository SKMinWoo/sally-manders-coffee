// Writes .ci/security.json, the "security" figure: open CodeQL alerts on main, npm audit's counts
// for what ships and for everything, and SonarCloud's quality gate. A tool that hasn't analysed
// the repository yet is null, which /office leaves out rather than showing as zero.
//
// Dependabot's alerts can't be read with the workflow's token, so they aren't counted here; its
// configuration (.github/dependabot.yml) and the pull requests it opens are the evidence.

import { spawnSync } from "node:child_process";
import { writeFile } from "node:fs/promises";

const { GITHUB_TOKEN: token, GITHUB_REPOSITORY: repo, SONAR_PROJECT_KEY: sonarKey } = process.env;

function audit(omitDev) {
  const args = ["audit", "--json", ...(omitDev ? ["--omit=dev"] : [])];
  // npm is a .cmd on Windows, which needs a shell; CI (Linux) runs it directly
  const r = process.platform === "win32"
    ? spawnSync(`npm ${args.join(" ")}`, { encoding: "utf8", shell: true })
    : spawnSync("npm", args, { encoding: "utf8" });
  const v = JSON.parse(r.stdout).metadata?.vulnerabilities;
  if (!v) throw new Error(`npm audit gave no counts: ${r.stdout.slice(0, 300)}`);
  return { critical: v.critical, high: v.high, moderate: v.moderate, low: v.low };
}

async function codeScanningOpen() {
  if (!token || !repo) return null;
  let open = 0;
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/${repo}/code-scanning/alerts?state=open&per_page=100&page=${page}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
    });
    if (res.status === 404) return null; // CodeQL hasn't analysed this repository yet
    if (!res.ok) throw new Error(`code scanning alerts: ${res.status} ${await res.text()}`);
    const alerts = await res.json();
    open += alerts.length;
    if (alerts.length < 100) return open;
  }
}

async function sonarGate() {
  if (!sonarKey) return null;
  const res = await fetch(`https://sonarcloud.io/api/qualitygates/project_status?projectKey=${encodeURIComponent(sonarKey)}`);
  if (!res.ok) return null; // not imported into SonarCloud yet, or never scanned
  const status = (await res.json()).projectStatus?.status;
  return ["OK", "WARN", "ERROR"].includes(status) ? status : null;
}

const security = {
  codeScanningOpen: await codeScanningOpen(),
  audit: { production: audit(true), all: audit(false) },
  sonarGate: await sonarGate(),
};
await writeFile(".ci/security.json", `${JSON.stringify(security)}\n`);
console.log(`Security: ${JSON.stringify(security)}`);
