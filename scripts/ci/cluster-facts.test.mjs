import { test } from "node:test";
import assert from "node:assert/strict";
import { clusterFrom, clusterProblem } from "./cluster-facts.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const pod = (name, component, ready, phase = "Running") => ({
  metadata: { labels: { "app.kubernetes.io/name": name, "app.kubernetes.io/component": component } },
  status: { phase, conditions: [{ type: "Ready", status: ready ? "True" : "False" }] },
});
const app = { status: { resources: Array.from({ length: 8 }, () => ({})) } };
const pods = (shopReady = true) => ({
  items: [
    pod("postgres", "database", true),
    pod("neon-proxy", "database-proxy", true),
    pod("seed", "seed", false, "Succeeded"),
    pod("shop", "service", true),
    pod("shop", "service", shopReady),
  ],
});

test("the cluster's figure: one service, its pods and the database's, and the seed Job's finished pod left out", () => {
  const fact = clusterFrom({ app, pods: pods(), health: { status: "ok", commit: SHA }, sha: SHA, syncMs: 71_420.6 });
  assert.deepEqual(fact, { services: 1, pods: { ready: 4, total: 4 }, resources: 8, syncMs: 71_421, health: "ok", commitMatched: true });
  assert.equal(clusterProblem(fact), null);
});

test("the run fails on another commit, a degraded shop, or a pod that isn't ready, and says which", () => {
  const at = (over) => clusterProblem(clusterFrom({ app, pods: pods(), health: { status: "ok", commit: SHA }, sha: SHA, syncMs: 1, ...over }));
  assert.equal(at({ health: { status: "ok", commit: null } }), "the shop answered with another commit");
  assert.equal(at({ health: { status: "degraded", commit: SHA } }), "the shop's health is degraded");
  assert.equal(at({ pods: pods(false) }), "1 of 4 pods are not ready");
  assert.equal(at({ pods: { items: [pod("postgres", "database", true)] } }), "no pod runs the shop");
});
