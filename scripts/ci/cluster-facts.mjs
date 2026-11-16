// The cluster figure (exhibit 11, ADR 0008): what kind, Argo CD and the shop said once the chart
// was synced. CI saves them as JSON in cluster-results/ (ci.yml, job cluster), and this reads them.
//   cluster-results/app.json     kubectl -n argocd get application sally-manders -o json
//   cluster-results/pods.json    kubectl -n shop get pods -o json
//   cluster-results/health.json  /api/v1/health, through the shop's Service on the runner
//   SHA=<commit> SYNC_MS=<applied to synced and healthy> node scripts/ci/cluster-facts.mjs
// Writes .ci/cluster.json, and exits 1 if the shop isn't ok on this commit with every pod ready.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const isReady = (pod) => (pod.status?.conditions ?? []).some((c) => c.type === "Ready" && c.status === "True");

/**
 * The figure from what the cluster said. A pod that ran to completion (the seed Job's) is neither
 * ready nor missing, so it isn't counted; services are the Deployments that run the shop's own code.
 */
export function clusterFrom({ app, pods, health, sha, syncMs }) {
  const running = pods.items.filter((p) => p.status?.phase !== "Succeeded");
  const services = new Set(
    running.filter((p) => p.metadata?.labels?.["app.kubernetes.io/component"] === "service").map((p) => p.metadata.labels["app.kubernetes.io/name"]),
  );
  return {
    services: services.size,
    pods: { ready: running.filter(isReady).length, total: running.length },
    resources: (app.status?.resources ?? []).length,
    syncMs: Math.max(0, Math.round(syncMs)),
    health: health.status === "ok" ? "ok" : "degraded",
    commitMatched: health.commit === sha,
  };
}

/** Why the cluster's run should fail, or null when the shop is ok, on this commit, with every pod ready. */
export function clusterProblem(fact) {
  if (!fact.commitMatched) return "the shop answered with another commit";
  if (fact.health !== "ok") return "the shop's health is degraded";
  if (!fact.services) return "no pod runs the shop";
  if (fact.pods.ready < fact.pods.total) return `${fact.pods.total - fact.pods.ready} of ${fact.pods.total} pods are not ready`;
  return null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const read = (f) => JSON.parse(readFileSync(`cluster-results/${f}`, "utf8"));
  const { SHA: sha, SYNC_MS } = process.env;
  if (!/^[0-9a-f]{40}$/.test(sha ?? "") || !/^\d+$/.test(SYNC_MS ?? "")) throw new Error("SHA (a full commit) and SYNC_MS (whole ms) are required");
  const fact = clusterFrom({ app: read("app.json"), pods: read("pods.json"), health: read("health.json"), sha, syncMs: Number(SYNC_MS) });
  mkdirSync(".ci", { recursive: true });
  writeFileSync(".ci/cluster.json", JSON.stringify(fact));
  console.log(JSON.stringify(fact));
  const problem = clusterProblem(fact);
  if (problem) {
    console.log(`::error::${problem}`);
    process.exit(1);
  }
}
