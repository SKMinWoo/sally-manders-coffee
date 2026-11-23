import { test } from "node:test";
import assert from "node:assert/strict";
import meta from "@/components/front/cutaway.json";
import { AT_TILL_MS, CUP_LEAD_MS, crewAt, cupKindOf, cupsAt, inFront, plan, poseAt, route, spotOf, waitingAt, type Order, type World, type XY } from "./footfall";

const world = meta.world as unknown as World;
const T = Date.parse("2026-11-13T14:00:00Z");
const order = (s: number, wait: number, source: Order["source"] = "sim", items = 2): Order => ({ placedAt: T + s * 1000, readyAt: T + (s + wait) * 1000, items, source });
const near = (p: XY | undefined, k: string) => !!p && Math.hypot(p[0] - world.walk[k]![0], p[1] - world.walk[k]![1]) < 0.01;
const away = { sits: () => false };
const stay = { sits: () => true };

test("a guest is at the till when the order is placed, at a wait spot until it's ready, then collects the cup", () => {
  const [g] = plan([order(0, 150)], world, away);
  assert.ok(g!.start < g!.placedAt, "the walk in happens before the order");
  assert.ok(near(poseAt(g!, g!.placedAt)?.at, "till"));
  assert.ok(near(poseAt(g!, g!.placedAt + AT_TILL_MS - 1)?.at, "till"), "orders, then steps aside");
  assert.ok(near(poseAt(g!, g!.readyAt - 1)?.at, "wait-0"), "waits at the first spot");
  assert.equal(poseAt(g!, g!.readyAt - 1)?.moving, false);
  assert.equal(poseAt(g!, g!.readyAt + 100)?.moving, true, "goes for the cup when it's up, not before");
  assert.ok(near(poseAt(g!, g!.pickup)?.at, "pass"));
  assert.equal(poseAt(g!, g!.pickup)?.look, "cup", "and has it from the pass on");
  assert.equal(poseAt(g!, g!.end - 1)?.look, "cup", "a take-away leaves with it");
  assert.equal(poseAt(g!, g!.start - 1), null);
  assert.equal(poseAt(g!, g!.end), null);
});

test("each guest takes the lowest free spot, and a later order never moves an earlier guest", () => {
  const orders = [order(0, 300), order(30, 300), order(60, 300)];
  const first = plan(orders, world, stay);
  assert.deepEqual(first.map((g) => g.spot), [0, 1, 2]);
  const more = plan([...orders, order(400, 120)], world, stay);
  assert.deepEqual(more.slice(0, 3), first);
  assert.equal(more[3]!.spot, 0, "spot 0 is free again once its guest has left");
});

test("two orders in the same instant are two guests with their own keys", () => {
  const gs = plan([order(0, 200), order(0, 220)], world, away);
  assert.notEqual(gs[0]!.key, gs[1]!.key);
  assert.notEqual(gs[0]!.spot, gs[1]!.spot);
});

test("a guest who stays sits in a chair, one guest a chair, and takes away once the room is full", () => {
  const n = world.chairs.length;
  const gs = plan(Array.from({ length: n + 2 }, (_, i) => order(i * 5, 60)), world, stay);
  const seats = gs.map((g) => g.seat);
  assert.equal(new Set(seats.filter((x) => x !== null)).size, n, "every chair taken once");
  assert.deepEqual(seats.slice(n), [null, null], "the last two find the room full and take away");
  const satOf = (g: (typeof gs)[number]) => g.legs.find((l) => l.look === "seated")!;
  const inChair = gs.find((g) => g.seat !== null && world.chairs[g.seat]!.kind === "chair")!;
  const atLedge = gs.find((g) => g.seat !== null && world.chairs[g.seat]!.kind === "ledge")!;
  const sat = satOf(inChair);
  assert.ok(sat.t1 - sat.t0 >= 180_000 && sat.t1 - sat.t0 <= 360_000, "sits three to six minutes");
  assert.ok(sat.z > 0.3, "in a chair: on the seat, not the floor");
  assert.equal(poseAt(inChair, (sat.t0 + sat.t1) / 2)?.look, "seated");
  assert.equal(satOf(atLedge).z, 0, "at the ledge: stood on the floor");
});

test("most guests who stay go to the window ledge first, and every guest keeps one cup kind", () => {
  const gs = plan(Array.from({ length: 60 }, (_, i) => order(i * 400, 60)), world, stay); // one at a time: every place free
  const ledge = gs.filter((g) => g.seat !== null && world.chairs[g.seat]!.kind === "ledge").length;
  assert.ok(ledge > 30 && ledge < 52, `${ledge} of 60 chose the ledge, about two in three`);
  const kinds = new Set(gs.map((g) => cupKindOf(g.key)));
  assert.equal(kinds.size, 3, "all three cups turn up");
  assert.equal(cupKindOf(gs[0]!.key), cupKindOf(gs[0]!.key));
});

test("reduced motion: nobody walks, and the guest is there exactly from placedAt to readyAt (or the end of the sit)", () => {
  const [g] = plan([order(0, 150)], world, away);
  assert.equal(poseAt(g!, g!.placedAt - 1, true), null);
  assert.ok(near(poseAt(g!, g!.placedAt, true)?.at, "till"));
  assert.ok(near(poseAt(g!, g!.placedAt + AT_TILL_MS + 1, true)?.at, "wait-0"));
  assert.equal(poseAt(g!, g!.readyAt, true), null);
  const [s] = plan([order(0, 150)], world, stay);
  assert.equal(poseAt(s!, s!.readyAt, true)?.look, "seated", "a guest who stays appears in their chair");
});

test("waiting counts orders placed and not yet ready, the way the rail does", () => {
  const orders = [order(0, 100), order(50, 100), order(200, 100)];
  assert.equal(waitingAt(orders, T + 60_000), 2);
  assert.equal(waitingAt(orders, T + 100_000), 1, "the first is ready at 100 s");
  assert.equal(waitingAt(orders, T + 199_000), 0);
});

test("the crew: steam while a ticket is open, a cup on the pass until its guest takes it", () => {
  const gs = plan([order(0, 100)], world, away);
  const g = gs[0]!;
  assert.equal(crewAt(gs, g.placedAt - 60_000).busy, false);
  assert.equal(crewAt(gs, g.placedAt + 1000).busy, true);
  assert.equal(crewAt(gs, g.placedAt + 1000).till, "till", "the till barista serves the guest ordering");
  assert.equal(crewAt(gs, g.readyAt - CUP_LEAD_MS - 1000).machine, "pass", "the machine barista carries the cup over");
  assert.equal(cupsAt(gs, g.readyAt).length, 1);
  assert.equal(cupsAt(gs, g.pickup).length, 0, "gone once the guest has it");
});

// ── the proof that no peg walks through anything ────────────────────────────
const gap = (x: number, y: number, o: readonly number[]) => Math.hypot(Math.max(o[0]! - x, 0, x - o[1]!), Math.max(o[2]! - y, 0, y - o[3]!));
const isSeat = (p: XY) => world.chairs.some((c) => c.at[0] === p[0] && c.at[1] === p[1]);

test("every route plan() can walk keeps a peg's width clear of every obstacle", () => {
  // every street end, every wait spot, every chair, taking away and staying
  const orders = Array.from({ length: 40 }, (_, i) => order(i * 37, 30 + (i % 7) * 20, "sim", 1 + (i % 3)));
  const timelines = [...plan(orders, world, stay), ...plan(orders, world, away)];
  assert.ok(new Set(timelines.map((g) => g.seat).filter((s) => s !== null)).size === world.chairs.length, "the sample reaches every chair");
  const clear = world.pegRadius - 0.002; // the exported footprints are rounded to the millimetre
  let checked = 0;
  for (const g of timelines) {
    for (const l of g.legs) {
      if (l.from[0] === l.to[0] && l.from[1] === l.to[1]) continue;
      if (isSeat(l.from) || isSeat(l.to)) continue; // the step in and out of a chair is into the chair
      const n = Math.max(2, Math.ceil(Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1]) / 0.04));
      for (let i = 0; i <= n; i++) {
        const x = l.from[0] + ((l.to[0] - l.from[0]) * i) / n, y = l.from[1] + ((l.to[1] - l.from[1]) * i) / n;
        const hit = world.obstacles.find((o) => gap(x, y, o) < clear);
        assert.equal(hit, undefined, `${g.key} walks into ${JSON.stringify(hit)} at (${x.toFixed(2)}, ${y.toFixed(2)})`);
        checked++;
      }
    }
  }
  assert.ok(checked > 1000, `sampled ${checked} points`);
});

test("guests come from behind the van: the van's footprint is between the east spawn and the camera", () => {
  const van = meta.occluders.items.find((o) => o.id === "van")!;
  assert.ok(van.floor.some((r) => inFront(world, world.walk["street-e"]!, r as [number, number, number, number])));
  const lamp = meta.occluders.items.find((o) => o.id === "lamppost")!;
  const lane = route(world, "street-w", "door-out");
  assert.ok(lane.length >= 2);
  assert.equal(lamp.floor.some((r) => inFront(world, world.walk["till"]!, r as [number, number, number, number])), false, "nothing outside hides the till");
});

test("the projection puts a walking point where cutaway.py did", () => {
  for (const k of ["till", "door-out", "wait-3"]) {
    const [fx, fy, hx, hy] = spotOf(world, world.walk[k]!);
    const want = (meta.walk as Record<string, number[]>)[k]!;
    assert.ok(Math.abs(fx - want[0]!) < 0.5 && Math.abs(fy - want[1]!) < 0.5 && Math.abs(hx - want[2]!) < 0.5 && Math.abs(hy - want[3]!) < 0.5, `${k}: ${[fx, fy, hx, hy]} vs ${want}`);
  }
});
