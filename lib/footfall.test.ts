import { test } from "node:test";
import assert from "node:assert/strict";
import meta from "@/components/front/cutaway.json";
import { AT_TILL_MS, plan, poseAt, waitingAt, type Order, type Spot, type Walk } from "./footfall";

const walk = meta.walk as unknown as Walk;
const T = Date.parse("2026-11-13T14:00:00Z");
const order = (s: number, wait: number, source: Order["source"] = "sim"): Order => ({ placedAt: T + s * 1000, readyAt: T + (s + wait) * 1000, items: 2, source });
const at = (p: Spot | undefined, k: string) => p && Math.hypot(p[0] - walk[k]![0], p[1] - walk[k]![1]) < 0.01;

test("a guest is at the till when the order is placed, at a wait spot until it's ready, then walks out", () => {
  const [g] = plan([order(0, 150)], walk);
  assert.ok(g!.start < g!.placedAt, "the walk in happens before the order");
  assert.ok(at(poseAt(g!, g!.placedAt)?.spot, "till"));
  assert.ok(at(poseAt(g!, g!.placedAt + AT_TILL_MS - 1)?.spot, "till"), "orders, then steps aside");
  assert.ok(at(poseAt(g!, g!.readyAt - 1)?.spot, "wait-0"), "waits at the first spot");
  assert.equal(poseAt(g!, g!.readyAt - 1)?.moving, false);
  assert.equal(poseAt(g!, g!.readyAt + 500)?.moving, true, "leaves when the cup is up, not before");
  assert.equal(poseAt(g!, g!.start - 1), null);
  assert.equal(poseAt(g!, g!.end), null);
});

test("each guest takes the lowest free spot, and a later order never moves an earlier guest", () => {
  const orders = [order(0, 300), order(30, 300), order(60, 300)];
  const first = plan(orders, walk);
  assert.deepEqual(first.map((g) => g.spot), [0, 1, 2]);
  const more = plan([...orders, order(400, 120)], walk);
  assert.deepEqual(more.slice(0, 3), first);
  assert.equal(more[3]!.spot, 0, "spot 0 is free again once its guest has left");
});

test("two orders in the same instant are two guests with their own keys", () => {
  const gs = plan([order(0, 200), order(0, 220)], walk);
  assert.notEqual(gs[0]!.key, gs[1]!.key);
  assert.notEqual(gs[0]!.spot, gs[1]!.spot);
});

test("reduced motion: nobody walks, and the guest is there exactly from placedAt to readyAt", () => {
  const [g] = plan([order(0, 150)], walk);
  assert.equal(poseAt(g!, g!.placedAt - 1, true), null);
  assert.ok(at(poseAt(g!, g!.placedAt, true)?.spot, "till"));
  assert.ok(at(poseAt(g!, g!.placedAt + AT_TILL_MS + 1, true)?.spot, "wait-0"));
  assert.equal(poseAt(g!, g!.readyAt, true), null);
});

test("waiting counts orders placed and not yet ready, the way the rail does", () => {
  const orders = [order(0, 100), order(50, 100), order(200, 100)];
  assert.equal(waitingAt(orders, T + 60_000), 2);
  assert.equal(waitingAt(orders, T + 100_000), 1, "the first is ready at 100 s");
  assert.equal(waitingAt(orders, T + 199_000), 0);
});
