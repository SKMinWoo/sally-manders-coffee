// Posts what this CI run measured to the shop's back office (POST /api/ingest/ci). Each file in
// .ci/ is one figure, named for its kind: .ci/unit-tests.json is the "unit-tests" figure.
//
// Runs on pushes to main only. Vercel deploys the same commit at the same time, so the endpoint
// may not be up yet: a 404 or a 5xx is retried for a few minutes. Any other refusal fails the job,
// because it means the report itself is wrong.

import { readdir, readFile } from "node:fs/promises";

const { CI_INGEST_SECRET: secret, INGEST_URL: url, GITHUB_RUN_ID, GITHUB_SHA, GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env;
if (!secret || !url) {
  console.log("::notice::CI_INGEST_SECRET or INGEST_URL is not set; nothing posted.");
  process.exit(0); // nothing has opened a socket yet, so exiting here is safe
}

const files = (await readdir(".ci")).filter((f) => f.endsWith(".json"));
const facts = await Promise.all(files.map(async (f) => ({ kind: f.slice(0, -5), value: JSON.parse(await readFile(`.ci/${f}`, "utf8")) })));
const body = JSON.stringify({
  run: { id: Number(GITHUB_RUN_ID), url: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`, sha: GITHUB_SHA },
  facts,
});
console.log(`Posting ${facts.map((f) => f.kind).join(", ")}: ${body}`);

const TRIES = 12, WAIT_MS = 30_000;

/** True once stored; false on a refusal that retrying won't fix, or when every try went unanswered. */
async function post() {
  for (let i = 1; i <= TRIES; i++) {
    let status = 0, text = "";
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${secret}` }, body });
      status = res.status;
      text = await res.text();
    } catch (e) {
      text = String(e);
    }
    if (status === 200 || status === 201) {
      console.log(`Stored: ${text}`);
      return true;
    }
    console.log(`Try ${i}: ${status || "no answer"} ${text}`);
    if (!(status === 0 || status === 404 || status >= 500)) return false;
    if (i < TRIES) await new Promise((r) => setTimeout(r, WAIT_MS));
  }
  console.log("::error::The back office never answered; this run's figures were not posted.");
  return false;
}

// exitCode rather than process.exit(): exiting while fetch's sockets close trips a libuv assertion on Windows
process.exitCode = (await post()) ? 0 : 1;
