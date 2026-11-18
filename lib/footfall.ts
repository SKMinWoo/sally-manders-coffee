// Where each guest on the home page's model stands at any moment, worked out from nothing but the
// order the simulator (or a visitor) stored: placed at the till at placedAt, waiting by the
// hand-off end of the counter until readyAt, then out of the door. The walking either side is
// drawn before placedAt and after readyAt, so the wait on the model is exactly the stored wait.
// Pure, so the page and its tests run the same arithmetic.

/** A spot on the render: the feet, then the top of the head 1.6 m above, in the render's pixels. */
export type Spot = readonly [fx: number, fy: number, hx: number, hy: number];

/** The named spots cutaway.py exports: street-w, street-e, door-out, door-in, aisle, till, wait-0…. */
export type Walk = Readonly<Record<string, Spot>>;

export interface Order {
  placedAt: number;
  readyAt: number;
  items: number;
  source: "sim" | "visitor";
}

interface Leg {
  t0: number;
  t1: number;
  from: Spot;
  to: Spot;
}

export interface Timeline extends Order {
  /** stable across polls: the order's placedAt and its place among orders placed that instant */
  key: string;
  /** the wait spot it holds, as an index into the wait-k spots */
  spot: number;
  legs: Leg[];
  /** first and last instant it is on the model */
  start: number;
  end: number;
}

export interface Pose {
  spot: Spot;
  /** walking (for the bob), or standing still */
  moving: boolean;
}

/** Walking pace across the render, in its pixels a second (about a stroll at this scale). */
export const PACE = 110;
/** How long a guest stands at the till after ordering before stepping aside. */
export const AT_TILL_MS = 2500;

const dist = (a: Spot, b: Spot) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Legs along `route`, walking at PACE from `t0`; returns them and the time it arrives. */
function walkFrom(route: Spot[], t0: number): { legs: Leg[]; t: number } {
  const legs: Leg[] = [];
  let t = t0;
  for (let i = 1; i < route.length; i++) {
    const ms = (dist(route[i - 1]!, route[i]!) / PACE) * 1000;
    legs.push({ t0: t, t1: t + ms, from: route[i - 1]!, to: route[i]! });
    t += ms;
  }
  return { legs, t };
}

const routeLength = (route: Spot[]) => route.slice(1).reduce((s, p, i) => s + dist(route[i]!, p), 0);

/** Which end of the street a guest comes from and leaves by: fixed by the order, so a re-plan never flips it. */
const sideOf = (placedAt: number, salt: number) => ((Math.floor(placedAt / 1000) * 2654435761 + salt) >>> 0) % 3 === 0 ? "street-e" : "street-w";

/**
 * Every guest's walk. Orders go in placedAt order and each takes the lowest wait spot free by the
 * time it gets there, so adding later orders never moves an earlier guest.
 */
export function plan(orders: readonly Order[], walk: Walk): Timeline[] {
  const spots = Object.keys(walk).filter((k) => k.startsWith("wait-")).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  const freeAt = spots.map(() => -Infinity);
  const sorted = [...orders].sort((a, b) => a.placedAt - b.placedAt);
  const seen = new Map<number, number>();
  return sorted.map((o) => {
    const n = seen.get(o.placedAt) ?? 0;
    seen.set(o.placedAt, n + 1);
    const at = (k: string) => walk[k]!;
    const inside = [at("door-out"), at("door-in"), at("aisle"), at("till")];
    const into = [at(sideOf(o.placedAt, n)), ...inside];
    const start = o.placedAt - (routeLength(into) / PACE) * 1000;
    const walkIn = walkFrom(into, start);

    const leave = o.placedAt + AT_TILL_MS;
    // the lowest spot free when they reach it; if every spot is taken, the one that frees first
    let spot = freeAt.findIndex((t) => t <= leave);
    if (spot < 0) spot = freeAt.indexOf(Math.min(...freeAt));
    const toSpot = walkFrom([at("till"), at(spots[spot]!)], leave);
    const out = [at(spots[spot]!), at("aisle"), at("door-in"), at("door-out"), at(sideOf(o.readyAt, n + 1))];
    const walkOut = walkFrom(out, Math.max(o.readyAt, toSpot.t));
    freeAt[spot] = walkOut.legs[0]!.t1; // free once they've stepped away from it

    return {
      ...o,
      key: `${o.placedAt}-${n}`,
      spot,
      legs: [...walkIn.legs, ...toSpot.legs, ...walkOut.legs],
      start,
      end: walkOut.t,
    };
  });
}

const lerp = (a: Spot, b: Spot, f: number): Spot => [
  a[0] + (b[0] - a[0]) * f,
  a[1] + (b[1] - a[1]) * f,
  a[2] + (b[2] - a[2]) * f,
  a[3] + (b[3] - a[3]) * f,
];

/**
 * Where a guest is at `t`, or null when they're off the model. With `reduced` (reduced motion)
 * nobody walks: a guest is at the till from placedAt, at their spot once they've stepped aside,
 * and gone at readyAt, so the timing stays exactly as stored.
 */
export function poseAt(g: Timeline, t: number, reduced = false): Pose | null {
  if (reduced) {
    if (t < g.placedAt || t >= g.readyAt) return null;
    const legToSpot = g.legs.find((l) => l.t0 >= g.placedAt)!;
    return { spot: t < legToSpot.t0 ? legToSpot.from : legToSpot.to, moving: false };
  }
  if (t < g.start || t >= g.end) return null;
  for (const l of g.legs) {
    if (t < l.t0) return { spot: l.from, moving: false }; // standing before this leg starts
    if (t < l.t1) return { spot: lerp(l.from, l.to, (t - l.t0) / (l.t1 - l.t0)), moving: true };
  }
  return { spot: g.legs[g.legs.length - 1]!.to, moving: false };
}

/** Guests who have ordered and whose cup isn't up yet: the ones the rail is holding a ticket for. */
export const waitingAt = (gs: readonly Order[], t: number) => gs.filter((g) => g.placedAt <= t && t < g.readyAt).length;
