"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { crewAt, cupKindOf, cupsAt, depth, hashOf, inFront, plan, poseAt, spotOf, waitingAt, type Look, type Order, type Timeline, type World, type XY } from "@/lib/footfall";
import { PEGS, type Occluders, type PegMeta } from "./pegs";
import s from "./front.module.css";

/** The model runs this far behind the clock, so an order is known before its guest has to set off. */
export const DRAW_DELAY_MS = 30_000;
const POLL_MS = 12_000;
const KEEP_MS = 15 * 60_000;
const NS = "http://www.w3.org/2000/svg";

const reducedQuery = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (fn: () => void) => {
  const m = matchMedia(reducedQuery);
  m.addEventListener("change", fn);
  return () => m.removeEventListener("change", fn);
};
export const useReducedMotion = () =>
  useSyncExternalStore(subscribeReduced, () => matchMedia(reducedQuery).matches, () => false);

export interface FootfallState {
  orders: Order[];
  /** the instant the model is drawing, on the shop's clock; it never runs backwards */
  drawnNow: () => number;
  /** an order this browser just placed (the drawer): drawn at once, not after the feed's delay */
  add: (o: PlacedHere) => void;
}

/** What the drawer's server action hands back about the order it put on the rail. */
export interface PlacedHere {
  placedAt: number;
  readyAt: number;
  items: number;
}

/** About how long a guest takes from the street to the till (the routes run 6 to 9 m at PACE). */
const WALK_IN_MS = 13_000;
/** The same order as the feed will list it, so a poll never draws a guest the drawer already has. */
const feedKey = (o: { placedAt: number; readyAt: number; items: number }) => `${o.placedAt}|${o.readyAt}|${o.items}`;

/**
 * The guests: the server's first quarter hour, then whatever the API has that's new every few
 * seconds while the page is visible. Times are on the shop's clock, so a visitor whose own clock
 * is off still sees each guest at the right moment.
 *
 * The clock: each poll re-reads the shop's clock, estimated at the middle of the request so the
 * network's own delay doesn't drag it back, and the drawn instant is held from ever going backwards,
 * so a late reply can't make every figure step back a pace.
 */
export function useFootfall(initial: Order[], asOf: number, frozen: boolean, base: string): FootfallState {
  const [orders, setOrders] = useState(initial);
  const offset = useRef(0); // shop clock minus this browser's
  const shown = useRef(-Infinity); // the latest instant drawn, so the clock only runs forward
  const since = useRef(new Date(asOf).toISOString());
  const mine = useRef(new Set<string>());
  useEffect(() => {
    offset.current = asOf - Date.now();
  }, [asOf]);

  useEffect(() => {
    if (frozen) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const sent = Date.now();
          const r = await fetch(`${base}/api/v1/footfall?since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
          if (r.ok) {
            const body = (await r.json()) as { asOf: string; guests: { placedAt: string; readyAt: string; items: number; source: Order["source"] }[] };
            const at = Date.parse(body.asOf);
            offset.current = at - (sent + Date.now()) / 2;
            since.current = body.asOf;
            const cutoff = at - KEEP_MS;
            const fresh = body.guests
              .map((g) => ({ placedAt: Date.parse(g.placedAt), readyAt: Date.parse(g.readyAt), items: g.items, source: g.source }))
              .filter((g) => !mine.current.has(feedKey(g)));
            // an empty poll changes nothing, so nothing downstream re-plans or redraws
            setOrders((old) => {
              const kept = old.filter((o) => o.readyAt > cutoff);
              return fresh.length || kept.length !== old.length ? [...kept, ...fresh] : old;
            });
          }
        } catch {
          // the street goes quiet until the next poll; nobody is invented to fill it
        }
      }
      if (!stop) timer = setTimeout(poll, POLL_MS);
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [frozen, base]);

  const drawnNow = useCallback(() => {
    const t = Math.max(shown.current, Date.now() + offset.current - DRAW_DELAY_MS);
    shown.current = t;
    return t;
  }, []);

  // The visitor's own guest sets off from the street now, not half a minute from now: its times are
  // moved onto the drawn clock (the wait between them kept), and the feed's copy is skipped later.
  const add = useCallback((o: PlacedHere) => {
    mine.current.add(feedKey(o));
    const shift = o.placedAt - (Date.now() + offset.current - DRAW_DELAY_MS + WALK_IN_MS);
    setOrders((old) => [...old, { placedAt: o.placedAt - shift, readyAt: o.readyAt - shift, items: o.items, source: "visitor", mine: true }]);
  }, []);

  return useMemo(() => ({ orders, drawnNow, add }), [orders, drawnNow, add]);
}

/**
 * A figure on the model: its sprite twice, as lit with the reading lamp on and with it off (CSS
 * cross-fades the two with the room, front.module.css's lampOn/lampOff), feet at the origin and the
 * 1.6 m mark one unit up, so the frame loop scales it by the projected height where it stands; then
 * copies of whatever stands between it and the camera (cut from the render itself, in both lights),
 * clipped to the figure, so it passes behind the van, the lamp post or the counter exactly as the
 * render would have drawn it.
 *
 * A figure is made once, when its guest (or barista, or cup) first appears, and kept until it leaves:
 * a poll, a re-plan or the lamp going off only changes what it wears, so nobody blinks or starts over.
 */
interface Fig {
  g: SVGGElement;
  body: SVGGElement;
  on: SVGImageElement;
  off: SVGImageElement;
  clip: SVGRectElement;
  front: SVGGElement;
  /** the soft shadow under its feet, lamp off only (the lamp-off sprites are shot without one) */
  shade: SVGEllipseElement;
  /** the occluders in front of it now, and the sprite it wears, so the DOM changes only when they do */
  occ: string;
  src: string;
  seated: boolean;
}

/** The contact shadow's ellipse, in figure units (1 = 1.6 m): a little wider than the peg's 0.2 m
 * radius, foreshortened by the camera's 35° look down. */
const SHADE_RX = 0.17, SHADE_RY = SHADE_RX * Math.sin((35 * Math.PI) / 180);

let figN = 0;
function makeFig(peg: PegMeta, uid: string, title: string | null, mine = false): Fig {
  const id = `fig-${++figN}`;
  const g = document.createElementNS(NS, "g");
  const cp = document.createElementNS(NS, "clipPath");
  cp.id = id;
  const clip = document.createElementNS(NS, "rect");
  cp.append(clip);
  const body = document.createElementNS(NS, "g");
  body.setAttribute("class", s.peg!);
  if (title) {
    const t = document.createElementNS(NS, "title");
    t.textContent = title;
    body.append(t);
  }
  if (mine) {
    // the visitor's own guest: a thin brass ring on the floor round its feet
    const ring = document.createElementNS(NS, "ellipse");
    ring.setAttribute("rx", (SHADE_RX * 1.5).toFixed(4));
    ring.setAttribute("ry", (SHADE_RY * 1.5).toFixed(4));
    ring.setAttribute("class", s.mineRing!);
    body.append(ring);
  }
  const shade = document.createElementNS(NS, "ellipse");
  shade.setAttribute("rx", String(SHADE_RX));
  shade.setAttribute("ry", SHADE_RY.toFixed(4));
  shade.setAttribute("fill", `url(#${uid}-shade)`);
  shade.setAttribute("class", s.lampOff!);
  body.append(shade);
  const unit = peg.foot[1] - peg.top[1]; // the sprite's pixels per 1.6 m
  const image = (cls: string) => {
    const img = document.createElementNS(NS, "image");
    img.setAttribute("x", (-peg.foot[0] / unit).toFixed(4));
    img.setAttribute("y", (-peg.foot[1] / unit).toFixed(4));
    img.setAttribute("width", (peg.size[0] / unit).toFixed(4));
    img.setAttribute("height", (peg.size[1] / unit).toFixed(4));
    img.setAttribute("class", cls);
    body.append(img);
    return img;
  };
  const on = image(s.lampOn!);
  const off = image(s.lampOff!);
  const front = document.createElementNS(NS, "g");
  front.setAttribute("clip-path", `url(#${id})`);
  g.append(cp, body, front);
  return { g, body, on, off, clip, front, shade, occ: "", src: "", seated: false };
}

/** Steam: a few soft strands drawn in the figure's own units (1 = 1.6 m), rising by CSS alone. */
function wisps(n: number, h: number): SVGGElement {
  const g = document.createElementNS(NS, "g");
  g.setAttribute("class", s.steam!);
  for (let i = 0; i < n; i++) {
    const p = document.createElementNS(NS, "path");
    const dx = (i - (n - 1) / 2) * h * 0.35;
    p.setAttribute("d", `M${dx} 0 c ${-h * 0.25} ${-h * 0.3} ${h * 0.25} ${-h * 0.55} 0 ${-h * 0.85} s ${h * 0.25} ${-h * 0.6} 0 ${-h}`);
    p.setAttribute("class", s.wisp!);
    p.style.animationDelay = `${(-i * 0.9).toFixed(1)}s`;
    p.style.strokeWidth = (h * 0.14).toFixed(4);
    g.append(p);
  }
  return g;
}

const guestTitle = (g: Timeline) => {
  if (g.mine) return "Your order";
  const ready = new Date(g.readyAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
  return `${g.source === "visitor" ? "A real visitor's order" : "A simulated guest"} · ${g.items} item${g.items === 1 ? "" : "s"} · ready ${ready}`;
};

/** A barista's pace behind the counter, full-size metres a second. */
const CREW_PACE = 0.7;
/** How far apart cups stand on the pass, full-size metres. */
const CUP_GAP = 0.2;

/**
 * A guest's sprite in both lights, for the look it has on. Staying at the window ledge they stand,
 * empty-handed, their cup on the ledge in front of them; in a chair they're the seated peg.
 */
function paintOf(g: Timeline, look: Look, world: World): { on: string; off: string } {
  const cup = cupKindOf(g.key);
  const pick = (light: "night" | "dark") => {
    const p = PEGS[light];
    const guest = g.source === "visitor" ? p.visitor : p.simulated[hashOf(g.key) % p.simulated.length]!;
    if (look === "cup") return guest.cup[cup].src;
    if (look === "seated" && world.chairs[g.seat!]!.kind === "chair") return guest.seated.src;
    return guest.walk.src;
  };
  return { on: pick("night"), off: pick("dark") };
}
const BARISTA = { on: PEGS.night.barista.src, off: PEGS.dark.barista.src };
const cupPaint = (key: string) => {
  const k = cupKindOf(key);
  return { on: PEGS.night.cups[k].src, off: PEGS.dark.cups[k].src };
};

/**
 * Life on the model, in the render's own pixel space: the guests, the two baristas, the cups on the
 * pass and the machine's steam, all from the stored orders. One loop moves everything, by transform
 * only, and it stops when the model is off screen or the tab is hidden. The loop is started once:
 * new orders, a change of mind about reduced motion and the lamp going off reach it through a ref,
 * so the baristas keep their places and every figure its element.
 */
export function GuestsLayer({ world, occluders, state, width, height, peg }: {
  world: World;
  occluders: Occluders;
  state: FootfallState;
  width: number;
  height: number;
  peg: PegMeta;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const timelines = useMemo(() => plan(state.orders, world), [state.orders, world]);
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const live = useRef({ timelines, reduced, drawnNow: state.drawnNow });
  useEffect(() => {
    live.current = { timelines, reduced, drawnNow: state.drawnNow };
  }, [timelines, reduced, state.drawnNow]);

  useEffect(() => {
    const root = svg.current!;
    const layer = root.querySelector<SVGGElement>("[data-figures]")!;
    const steamLayer = root.querySelector<SVGGElement>("[data-cup-steam]")!;
    const machineSteam = root.querySelector<SVGGElement>("[data-machine-steam]")!;
    const figs = new Map<string, Fig>();
    const steams = new Map<string, SVGGElement>();
    /** each cup keeps the place on the pass it was set down in until its guest takes it */
    const slots = new Map<string, number>();
    const unit = peg.foot[1] - peg.top[1];
    const crew = {
      machine: { at: world.stations.machine!, moving: false },
      till: { at: world.stations.till!, moving: false },
    };
    let raf = 0, onScreen = true, order = "", last = performance.now();

    const [sx, sy, , shy] = spotOf(world, [world.steam[0], world.steam[1]], world.steam[2] - world.floor);
    machineSteam.setAttribute("transform", `translate(${sx.toFixed(1)} ${sy.toFixed(1)}) scale(${(sy - shy).toFixed(1)})`);

    /** Stands a figure at `at`, picks its occluders, and returns its depth for sorting. */
    const place = (f: Fig, at: XY, z: number, src: { on: string; off: string }, moving: boolean, t: number, phase: number, opacity: number) => {
      const [fx, fy, , hy] = spotOf(world, at, z);
      const h = fy - hy;
      // a little weight in the step: a rock from foot to foot and the smallest hop while walking (the
      // shadow is in the sprite, so a bigger hop would lift it off the floor too), still while standing
      const step = moving ? Math.abs(Math.sin((t + phase) / 170)) * 0.4 : 0;
      const sway = moving ? Math.sin((t + phase) / 170) * 2.5 : 0;
      f.body.setAttribute("transform", `translate(${fx.toFixed(1)} ${(fy - step * h * 0.035).toFixed(1)}) rotate(${sway.toFixed(2)}) scale(${h.toFixed(2)})`);
      f.g.style.opacity = opacity.toFixed(2);
      if (f.src !== src.on) {
        f.src = src.on;
        f.on.setAttribute("href", src.on);
        f.off.setAttribute("href", src.off);
      }
      // the sprite's box on the render, a little wider for the sway
      const x0 = fx - (peg.foot[0] / unit) * h * 1.04, y0 = fy - (peg.foot[1] / unit) * h * 1.02;
      const w = (peg.size[0] / unit) * h * 1.08, hh = (peg.size[1] / unit) * h * 1.04;
      f.clip.setAttribute("x", x0.toFixed(1));
      f.clip.setAttribute("y", y0.toFixed(1));
      f.clip.setAttribute("width", w.toFixed(1));
      f.clip.setAttribute("height", hh.toFixed(1));
      const hide = occluders.items.filter((o) => {
        const [ox, oy, ow, oh] = o.frame;
        return ox < x0 + w && x0 < ox + ow && oy < y0 + hh && y0 < oy + oh && o.floor.some((r) => inFront(world, at, r));
      });
      const occ = hide.map((o) => o.id).join(",");
      if (occ !== f.occ) {
        f.occ = occ;
        f.front.replaceChildren(
          ...hide.flatMap((o) =>
            (["on", "off"] as const).map((light) => {
              const u = document.createElementNS(NS, "use");
              u.setAttribute("href", `#${uid}-${o.id}-${light}`);
              u.setAttribute("x", String(o.frame[0]));
              u.setAttribute("y", String(o.frame[1]));
              u.setAttribute("width", String(o.frame[2]));
              u.setAttribute("height", String(o.frame[3]));
              u.setAttribute("class", light === "on" ? s.lampOn! : s.lampOff!);
              return u;
            }),
          ),
        );
      }
      return depth(world, at[0], at[1]);
    };

    const frame = () => {
      raf = 0;
      const { timelines, reduced, drawnNow } = live.current;
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = drawnNow();
      const shown: { key: string; f: Fig; d: number }[] = [];
      const seen = new Set<string>();
      const show = (key: string, make: () => Fig, at: XY, z: number, src: { on: string; off: string }, moving: boolean, phase: number, opacity = 1) => {
        let f = figs.get(key);
        if (!f) figs.set(key, (f = make()));
        seen.add(key);
        shown.push({ key, f, d: place(f, at, z, src, moving, t, phase, opacity) });
        return f;
      };

      for (const g of timelines) {
        const pose = poseAt(g, t, reduced);
        if (!pose) continue;
        const from = reduced ? g.placedAt : g.start;
        const to = reduced ? (g.seat === null ? g.readyAt : g.legs.find((l) => l.look === "seated")!.t1) : g.end;
        const fade = Math.max(0, Math.min(1, (t - from) / 500, (to - t) / 500));
        const f = show(g.key, () => makeFig(peg, uid, guestTitle(g), g.mine), pose.at, pose.z, paintOf(g, pose.look, world), pose.moving, hashOf(g.key) % 1000, fade);
        const stay = pose.look === "seated" ? world.chairs[g.seat!]! : null;
        // a seated guest's shadow is the chair's business (one stood at the ledge keeps theirs)
        const seated = stay?.kind === "chair";
        if (seated !== f.seated) {
          f.seated = seated;
          f.shade.setAttribute("visibility", seated ? "hidden" : "visible");
        }
        // while they stay, their cup stands in front of them, on the table or the ledge
        if (stay) {
          const [cx, cy, cz] = stay.cup;
          show(`seatcup-${g.key}`, () => makeFig(peg, uid, null), [cx, cy], cz - world.floor, cupPaint(g.key), false, 0, fade);
        }
      }

      // the cups waiting on the pass, side by side along it, each in the place it was set down
      const cups = cupsAt(timelines, t);
      const onPass = new Set(cups.map((g) => g.key));
      for (const k of slots.keys()) if (!onPass.has(k)) slots.delete(k);
      for (const g of cups) {
        let slot = slots.get(g.key);
        if (slot === undefined) {
          const taken = new Set(slots.values());
          for (slot = 0; taken.has(slot); slot++);
          slots.set(g.key, slot);
        }
        const at: XY = [world.cup[0] + slot * CUP_GAP, world.cup[1]];
        const key = `cup-${g.key}`;
        show(key, () => makeFig(peg, uid, null), at, world.cup[2] - world.floor, cupPaint(g.key), false, 0);
        // its steam, on a layer of its own that's never re-sorted, so the strands never restart
        let st = steams.get(key);
        if (!st) {
          st = wisps(2, 0.12);
          steams.set(key, st);
          steamLayer.append(st);
        }
        const [cx, cy, , chy] = spotOf(world, at, world.cup[2] - world.floor);
        st.setAttribute("transform", `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) scale(${(cy - chy).toFixed(2)})`);
      }
      for (const [k, st] of steams) {
        if (!onPass.has(k.slice(4))) {
          st.remove();
          steams.delete(k);
        }
      }

      // the baristas walk to wherever the orders want them, along the back of the counter
      const want = crewAt(timelines, t);
      for (const [who, c] of Object.entries(crew) as [keyof typeof crew, (typeof crew)["till"]][]) {
        const goal = world.stations[want[who]]!;
        const dx = goal[0] - c.at[0], dy = goal[1] - c.at[1], d = Math.hypot(dx, dy);
        const stepM = reduced ? d : Math.min(d, CREW_PACE * dt);
        c.at = d < 1e-4 ? goal : [c.at[0] + (dx / d) * stepM, c.at[1] + (dy / d) * stepM];
        c.moving = !reduced && d > 0.02;
        show(`barista-${who}`, () => makeFig(peg, uid, null), c.at, 0, BARISTA, c.moving, who === "till" ? 400 : 0);
      }
      machineSteam.toggleAttribute("data-on", want.busy);

      for (const [k, f] of figs) {
        if (!seen.has(k)) {
          f.g.remove();
          figs.delete(k);
        }
      }
      // farther figures first, so nearer ones are drawn over them; only the ones out of place move
      shown.sort((a, b) => b.d - a.d);
      const next = shown.map((x) => x.key).join(",");
      if (next !== order) {
        order = next;
        let at: ChildNode | null = layer.firstChild;
        for (const x of shown) {
          if (x.f.g === at) at = at.nextSibling;
          else layer.insertBefore(x.f.g, at);
        }
      }
      if (onScreen && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && onScreen && document.visibilityState === "visible") {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    const io = new IntersectionObserver(([e]) => {
      onScreen = !!e?.isIntersecting;
      wake();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
      for (const f of figs.values()) f.g.remove();
      for (const st of steams.values()) st.remove();
    };
  }, [peg, world, occluders, uid]);

  const [aw, ah] = occluders.atlas;
  return (
    <svg ref={svg} className={s.guests} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-shade`}>
          <stop offset="0" stopColor="#1A120C" stopOpacity=".55" />
          <stop offset=".55" stopColor="#1A120C" stopOpacity=".3" />
          <stop offset="1" stopColor="#1A120C" stopOpacity="0" />
        </radialGradient>
        {occluders.items.flatMap((o) =>
          (["on", "off"] as const).map((light) => (
            <symbol key={`${o.id}-${light}`} id={`${uid}-${o.id}-${light}`} viewBox={`${o.at[0]} ${o.at[1]} ${o.frame[2]} ${o.frame[3]}`} preserveAspectRatio="none">
              <image href={PEGS[light === "on" ? "night" : "dark"].occluders.src} width={aw} height={ah} />
            </symbol>
          )),
        )}
      </defs>
      <g data-figures="" />
      <g data-cup-steam="" />
      {/* the espresso machine's steam, while there's a ticket on the rail */}
      <g data-machine-steam="" className={s.machineSteam}>
        <MachineWisps />
      </g>
    </svg>
  );
}

/** The machine's steam: three strands, in the figure units the layer scales by (1 = 1.6 m). */
function MachineWisps() {
  // toy steam, not physics: a third of a metre of it, in strands thick enough to read at phone width
  const h = 0.3;
  return (
    <g className={s.steam}>
      {[0, 1, 2].map((i) => {
        const dx = (i - 1) * h * 0.22;
        return (
          <path
            key={i}
            className={s.wisp}
            d={`M${dx} 0 c ${-h * 0.25} ${-h * 0.3} ${h * 0.25} ${-h * 0.55} 0 ${-h * 0.85} s ${h * 0.25} ${-h * 0.6} 0 ${-h}`}
            style={{ animationDelay: `${-i * 0.9}s`, strokeWidth: h * 0.11 }}
          />
        );
      })}
    </g>
  );
}

const clockFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });

/**
 * The second the model is drawing, once a second; null on the server and while hydrating, since
 * the two can't agree on the second, so the figures wait for the browser.
 */
const subscribeSecond = (fn: () => void) => {
  const id = setInterval(fn, 1000);
  return () => clearInterval(id);
};
const thisSecond = () => Math.floor(Date.now() / 1000);
export function useDrawnNow(state: FootfallState): number | null {
  const second = useSyncExternalStore(subscribeSecond, thisSecond, () => null);
  return second === null ? null : state.drawnNow();
}

/** Under the model: Austin's time on the model, the last quarter hour's orders and who's waiting. */
export function GuestCaption({ state, frozen, replay }: { state: FootfallState; frozen: boolean; replay?: { from: number; until: number } }) {
  const t = useDrawnNow(state);
  if (frozen) {
    return <p className={`cond ${s.caption}`}>The clock is stopped, so the guests are too · simulated guests are painted mustard, navy or oxblood, real visitors teal</p>;
  }
  // a replayed guest is drawn, never counted
  const recent = t === null ? null : state.orders.filter((o) => !o.replay && o.placedAt > t - KEEP_MS && o.placedAt <= t).length;
  const replaying = replay !== undefined && t !== null && t < replay.until;
  const live = state.orders.filter((o) => !o.replay);
  const waiting = t === null ? null : waitingAt(live, t);
  return (
    <p className={`cond ${s.caption}`} aria-live="off">
      <span className={s.live}>{t === null ? "—" : clockFmt.format(t).toLowerCase()} in Austin</span>
      {replaying && <span className={s.replay}>Replay: it&rsquo;s quiet, so this is {clockFmt.format(replay.from).toLowerCase()}&rsquo;s busiest quarter hour</span>}
      <span>{recent ?? "—"} order{recent === 1 ? "" : "s"} in the last 15 min</span>
      <span>{waiting ?? "—"} waiting at the counter</span>
      <span className={s.key}>
        each figure is one order: <i className={s.keySim} aria-hidden="true" /> simulated <i className={s.keyVisitor} aria-hidden="true" /> a real visitor&rsquo;s · half a minute behind
      </span>
    </p>
  );
}

/** How many tickets are on the rail at the instant the model is drawing. */
export function RailCount({ state }: { state: FootfallState }) {
  const t = useDrawnNow(state);
  return <>{t === null ? "—" : waitingAt(state.orders.filter((o) => !o.replay), t)} on the rail</>;
}
