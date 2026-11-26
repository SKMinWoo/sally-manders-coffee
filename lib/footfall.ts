// Where each guest on the home page's model stands at any moment, worked out from nothing but the
// order the simulator (or a visitor) stored: placed at the till at placedAt, waiting by the counter
// until readyAt, then a cup from the pass and either out of the door or a seat in the dining room.
// The walking either side is drawn before placedAt and after readyAt, so the wait on the model is
// exactly the stored wait. Guests walk in the model's own metres, only along the walking graph
// cutaway.py checks against every obstacle, and the page projects them through the render's camera.
// Pure, so the page and its tests run the same arithmetic.

/** A spot on the render: the feet, then the top of the head 1.6 m above, in the render's pixels. */
export type Spot = readonly [fx: number, fy: number, hx: number, hy: number];
/** A point on the shop floor, in full-size metres. */
export type XY = readonly [x: number, y: number];

/** The named spots cutaway.py exports in pixels: street-w, street-e, door-out, …, wait-0…, queue-0…. */
export type Walk = Readonly<Record<string, Spot>>;

export interface Chair {
  /** the seat's centre and height, full-size metres (a ledge place's height is the floor's) */
  at: readonly [number, number, number];
  facing: string;
  /** the walking point a guest steps in from */
  from: string;
  /** a dining chair, sat in (the peg drops into its socket), or a place at the window ledge, stood at */
  kind: "chair" | "ledge";
  /** where the guest's cup is set down while they stay: the table in front, or the ledge */
  cup: readonly [number, number, number];
}

/** The three cups the set's guests carry. */
export type CupKind = "tumbler" | "kraft" | "mug";
export const CUP_KINDS: readonly CupKind[] = ["tumbler", "kraft", "mug"];
/** A guest's cup, fixed by the order like everything else about them. */
export const cupKindOf = (key: string): CupKind => CUP_KINDS[hashOf(key, 17) % CUP_KINDS.length]!;

/** The floor plan behind the render (cutaway.json's "world"). */
export interface World {
  floor: number;
  /** the render's camera: full-size metres to the render's pixels, as a 3x4 projective matrix */
  proj: readonly (readonly number[])[];
  /** the camera's position, full-size metres */
  camera: readonly [number, number, number];
  pegRadius: number;
  walk: Readonly<Record<string, XY>>;
  edges: readonly (readonly [string, string])[];
  chairs: readonly Chair[];
  stations: Readonly<Record<string, XY>>;
  /** where a cup is set down on the pass, and where the machine's steam leaves it */
  cup: readonly [number, number, number];
  steam: readonly [number, number, number];
  /** every solid thing's floor footprint, [x0, x1, y0, y1] */
  obstacles: readonly (readonly [number, number, number, number])[];
}

export interface Order {
  placedAt: number;
  readyAt: number;
  items: number;
  source: "sim" | "visitor";
  /** this browser placed it (the drawer): known only here, never in the public feed */
  mine?: boolean;
  /** a stored order from a busier hour, replayed while the street is quiet (lib/replay.ts) */
  replay?: boolean;
}

/** What the figure looks like on a leg: walking empty-handed, carrying a cup, or sat down. */
export type Look = "walk" | "cup" | "seated";

export interface Leg {
  t0: number;
  t1: number;
  from: XY;
  to: XY;
  look: Look;
  /** how far above the floor the figure's base is (a seat's height while sitting) */
  z: number;
}

export interface Timeline extends Order {
  /** stable across polls: the order's placedAt and its place among orders placed that instant */
  key: string;
  /** the wait spot it holds, as an index into the wait-k spots */
  spot: number;
  /** the chair it takes after collecting its cup, or null to take it away */
  seat: number | null;
  /** when the guest reaches the pass and the cup leaves it */
  pickup: number;
  /** back-to-back legs from start to end; a leg whose from and to are the same is standing still */
  legs: Leg[];
  /** first and last instant it is on the model */
  start: number;
  end: number;
}

export interface Pose {
  at: XY;
  z: number;
  look: Look;
  /** walking (for the bob), or standing still */
  moving: boolean;
}

/** Walking pace, full-size metres a second: an unhurried stroll. */
export const PACE = 0.6;
/** How long a guest stands at the till after ordering before stepping aside. */
export const AT_TILL_MS = 2500;
/** How long a guest stands at the pass taking the cup. */
export const AT_PASS_MS = 900;
/** The barista sets the cup on the pass this long before the order's readyAt. */
export const CUP_LEAD_MS = 1200;

const dist = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const same = (a: XY, b: XY) => a[0] === b[0] && a[1] === b[1];

/** One hash for every "pick by the order" choice, so a guest's choices survive polls and reloads. */
export function hashOf(key: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Who stays for a seat in the dining room once their cup is up, rather than taking it away.
 *
 * A café-feel call (decision 0009, proposed): a guest with two or more items stays (a coffee and a
 * pastry is a sit-down), and one in three of the rest stay too, picked by the order's own hash so
 * it never flickers between polls. Seats are claimed one guest each, and when the 8 chairs are all
 * taken a guest takes away whatever this says, so a busy hour fills the room without overflowing it.
 */
export function staysToSit(order: Order, key: string): boolean {
  return order.items >= 2 || hashOf(key, 7) % 3 === 0;
}

/** How long a seated guest stays: 3 to 6 minutes, fixed by the order. */
export const sitMs = (key: string) => 180_000 + (hashOf(key, 11) % 180_001);

/** The shortest route between two walking points over the graph's edges. */
export function route(world: World, from: string, to: string): XY[] {
  const adj = new Map<string, string[]>();
  for (const [a, b] of world.edges) {
    adj.set(a, [...(adj.get(a) ?? []), b]);
    adj.set(b, [...(adj.get(b) ?? []), a]);
  }
  const best = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, string>();
  const open = new Set([from]);
  while (open.size) {
    let u = "";
    for (const k of open) if (!u || best.get(k)! < best.get(u)!) u = k;
    open.delete(u);
    if (u === to) break;
    for (const v of adj.get(u) ?? []) {
      const d = best.get(u)! + dist(world.walk[u]!, world.walk[v]!);
      if (d < (best.get(v) ?? Infinity)) {
        best.set(v, d);
        prev.set(v, u);
        open.add(v);
      }
    }
  }
  if (!best.has(to)) throw new Error(`no walking route from ${from} to ${to}`);
  const names = [to];
  while (names[0] !== from) names.unshift(prev.get(names[0]!)!);
  return names.map((k) => world.walk[k]!);
}

/** Legs that walk `pts` from `t0` at PACE; returns them and the time it arrives. */
function walk(pts: XY[], t0: number, look: Look): { legs: Leg[]; t: number } {
  const legs: Leg[] = [];
  let t = t0;
  for (let i = 1; i < pts.length; i++) {
    if (same(pts[i - 1]!, pts[i]!)) continue;
    const ms = (dist(pts[i - 1]!, pts[i]!) / PACE) * 1000;
    legs.push({ t0: t, t1: t + ms, from: pts[i - 1]!, to: pts[i]!, look, z: 0 });
    t += ms;
  }
  return { legs, t };
}
const stand = (at: XY, t0: number, t1: number, look: Look, z = 0): Leg[] => (t1 > t0 ? [{ t0, t1, from: at, to: at, look, z }] : []);
const length = (pts: XY[]) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i]!, p), 0);

/** Which end of the street a guest comes from and leaves by: fixed by the order, so a re-plan never flips it. */
const sideOf = (placedAt: number, salt: number) => ((Math.floor(placedAt / 1000) * 2654435761 + salt) >>> 0) % 3 === 0 ? "street-e" : "street-w";

export interface PlanOptions {
  /** who stays for a seat (staysToSit unless a test says otherwise) */
  sits?: (order: Order, key: string) => boolean;
}

/**
 * Every guest's walk. Orders go in placedAt order; each takes the lowest wait spot free by the time
 * it gets there, and a chair only if nobody already planned is in it over the whole of its stay, so
 * adding later orders never moves an earlier guest.
 */
export function plan(orders: readonly Order[], world: World, opts: PlanOptions = {}): Timeline[] {
  const sits = opts.sits ?? staysToSit;
  const spots = Object.keys(world.walk).filter((k) => k.startsWith("wait-")).sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  const freeAt = spots.map(() => -Infinity);
  const held = world.chairs.map(() => [] as [number, number][]);
  const sorted = [...orders].sort((a, b) => a.placedAt - b.placedAt);
  const seen = new Map<number, number>();
  const at = (k: string) => world.walk[k]!;

  return sorted.map((o) => {
    const n = seen.get(o.placedAt) ?? 0;
    seen.set(o.placedAt, n + 1);
    const key = `${o.placedAt}-${n}`;

    // in from the street to the till, arriving exactly as the order is placed
    const into = route(world, sideOf(o.placedAt, n), "till");
    const start = o.placedAt - (length(into) / PACE) * 1000;
    const legs: Leg[] = [...walk(into, start, "walk").legs, ...stand(at("till"), o.placedAt, o.placedAt + AT_TILL_MS, "walk")];

    // aside to the lowest wait spot free when they reach it; if every spot is taken, the one that frees first
    const leave = o.placedAt + AT_TILL_MS;
    let spot = freeAt.findIndex((t) => t <= leave);
    if (spot < 0) spot = freeAt.indexOf(Math.min(...freeAt));
    const waitAt = at(spots[spot]!);
    const aside = walk([at("till"), waitAt], leave, "walk");
    legs.push(...aside.legs);
    const goAt = Math.max(o.readyAt, aside.t);
    legs.push(...stand(waitAt, aside.t, goAt, "walk"));

    // the cup is up: to the pass for it
    const toPass = walk([waitAt, at("pass")], goAt, "walk");
    freeAt[spot] = toPass.legs[0]?.t1 ?? goAt; // free once they've stepped away from it
    legs.push(...toPass.legs);
    const pickup = toPass.t;
    const taken = pickup + AT_PASS_MS;
    legs.push(...stand(at("pass"), pickup, taken, "cup"));

    // a seat, if they're staying and one is free for the whole stay; otherwise out with the cup
    let seat: number | null = null;
    if (sits(o, key)) {
      // most guests look for a place at the window ledge first, one in three for a chair; either way
      // they take the other kind if theirs is full, and within a kind the order's hash picks
      const ledgeFirst = hashOf(key, 13) % 3 !== 0;
      const rank = (i: number) => ((world.chairs[i]!.kind === "ledge") === ledgeFirst ? 0 : 1);
      const order = world.chairs
        .map((_, i) => i)
        .sort((a, b) => rank(a) - rank(b) || hashOf(`${key}:${a}`) - hashOf(`${key}:${b}`));
      for (const i of order) {
        const c = world.chairs[i]!;
        const seatAt: XY = [c.at[0], c.at[1]];
        const there = walk([...route(world, "pass", c.from), seatAt], taken, "cup");
        const up = there.t + sitMs(key);
        const outRoute = [seatAt, ...route(world, c.from, sideOf(o.readyAt, n + 1))];
        if (held[i]!.some(([a, b]) => a < up + 1000 && there.t - 1000 < b)) continue;
        held[i]!.push([there.t, up]);
        seat = i;
        legs.push(...there.legs, ...stand(seatAt, there.t, up, "seated", c.at[2] - world.floor));
        const out = walk(outRoute, up, "walk");
        legs.push(...out.legs);
        return { ...o, key, spot, seat, pickup, legs, start, end: out.t };
      }
    }
    const out = walk(route(world, "pass", sideOf(o.readyAt, n + 1)), taken, "cup");
    legs.push(...out.legs);
    return { ...o, key, spot, seat, pickup, legs, start, end: out.t };
  });
}

/**
 * Where a guest is at `t`, or null when they're off the model. With `reduced` (reduced motion)
 * nobody walks: a guest is at the till from placedAt, at their spot once they've stepped aside,
 * then in their chair if they stay, and gone at readyAt if they don't, so the timing stays
 * exactly as stored.
 */
export function poseAt(g: Timeline, t: number, reduced = false): Pose | null {
  if (reduced) {
    if (t < g.placedAt) return null;
    const legOf = (pred: (l: Leg) => boolean) => g.legs.find(pred);
    if (t < g.placedAt + AT_TILL_MS) return { at: g.legs.find((l) => l.t0 >= g.placedAt)!.from, z: 0, look: "walk", moving: false };
    if (t < g.readyAt) {
      const waiting = legOf((l) => l.t0 >= g.placedAt + AT_TILL_MS && same(l.from, l.to)) ?? g.legs.find((l) => l.t0 >= g.placedAt + AT_TILL_MS)!;
      return { at: waiting.to, z: 0, look: "walk", moving: false };
    }
    const sat = g.seat === null ? undefined : legOf((l) => l.look === "seated");
    if (sat && t < sat.t1) return { at: sat.to, z: sat.z, look: "seated", moving: false };
    return null;
  }
  if (t < g.start || t >= g.end) return null;
  for (const l of g.legs) {
    if (t < l.t0) return { at: l.from, z: l.z, look: l.look, moving: false }; // a gap: standing before the leg
    if (t < l.t1) {
      const f = (t - l.t0) / (l.t1 - l.t0);
      const moving = !same(l.from, l.to);
      return { at: [l.from[0] + (l.to[0] - l.from[0]) * f, l.from[1] + (l.to[1] - l.from[1]) * f], z: l.z, look: l.look, moving };
    }
  }
  const last = g.legs[g.legs.length - 1]!;
  return { at: last.to, z: last.z, look: last.look, moving: false };
}

/** Guests who have ordered and whose cup isn't up yet: the ones the rail is holding a ticket for. */
export const waitingAt = (gs: readonly Order[], t: number) => gs.filter((g) => g.placedAt <= t && t < g.readyAt).length;

/** The cups standing on the pass at `t`: set down just before readyAt, gone once their guest takes one. */
export const cupsAt = (gs: readonly Timeline[], t: number) => gs.filter((g) => g.readyAt - CUP_LEAD_MS <= t && t < g.pickup);

/** Where each barista heads at `t`: the station names in world.stations. */
export interface Crew {
  /** at the espresso machine while any ticket is open, carrying cups to the pass as they come up */
  machine: string;
  /** at the till while a guest is ordering, otherwise by the grinder at the back bar */
  till: string;
  /** the machine is working: steam rises */
  busy: boolean;
}
export function crewAt(gs: readonly Timeline[], t: number): Crew {
  const busy = gs.some((g) => g.placedAt <= t && t < g.readyAt);
  const carrying = gs.some((g) => g.readyAt - CUP_LEAD_MS - 2500 <= t && t < g.readyAt - CUP_LEAD_MS + 600);
  const ordering = gs.some((g) => g.placedAt - 4000 <= t && t < g.placedAt + AT_TILL_MS);
  return { machine: carrying ? "pass" : "machine", till: ordering ? "till" : "backbar", busy };
}

/** A point in full-size metres to the render's pixels, through the camera cutaway.py fitted. */
export function project(world: World, x: number, y: number, z: number): [number, number] {
  const [a, b, c] = world.proj as [number[], number[], number[]];
  const w = c[0]! * x + c[1]! * y + c[2]! * z + c[3]!;
  return [(a[0]! * x + a[1]! * y + a[2]! * z + a[3]!) / w, (b[0]! * x + b[1]! * y + b[2]! * z + b[3]!) / w];
}
/** How far from the camera, for drawing nearer figures over farther ones (bigger is farther). */
export function depth(world: World, x: number, y: number, z = world.floor): number {
  const c = world.proj[2]!;
  return c[0]! * x + c[1]! * y + c[2]! * z + c[3]!;
}
/** A figure standing at `at` with its base `z` above the floor: its feet and its 1.6 m mark, in pixels. */
export function spotOf(world: World, at: XY, z = 0): Spot {
  const [fx, fy] = project(world, at[0], at[1], world.floor + z);
  const [hx, hy] = project(world, at[0], at[1], world.floor + z + 1.6);
  return [fx, fy, hx, hy];
}

/**
 * Whether a footprint stands between a figure and the camera: a ray from the figure towards the
 * camera along the floor (and one either side, a peg's width apart) enters the rectangle ahead of
 * the figure. A figure inside a footprint (a guest sat at a chair) isn't hidden by it.
 */
export function inFront(world: World, at: XY, rect: readonly [number, number, number, number]): boolean {
  const dx = world.camera[0] - at[0], dy = world.camera[1] - at[1];
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const r = world.pegRadius;
  for (const side of [0, -r, r]) {
    const ox = at[0] - uy * side, oy = at[1] + ux * side;
    let t0 = -Infinity, t1 = Infinity;
    for (const [o, u, lo, hi] of [[ox, ux, rect[0], rect[1]], [oy, uy, rect[2], rect[3]]] as const) {
      if (Math.abs(u) < 1e-9) {
        if (o < lo || o > hi) { t0 = Infinity; break; }
        continue;
      }
      const a = (lo - o) / u, b = (hi - o) / u;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 > 1e-6 && t0 <= t1 && t0 < len) return true;
  }
  return false;
}
