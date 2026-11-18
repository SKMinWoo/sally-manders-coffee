"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { plan, poseAt, waitingAt, type Order, type Timeline, type Walk } from "@/lib/footfall";
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
  /** the instant the model is drawing, on the shop's clock */
  drawnNow: () => number;
}

/**
 * The guests: the server's first quarter hour, then whatever the API has that's new every few
 * seconds while the page is visible. Times are on the shop's clock, so a visitor whose own clock
 * is off still sees each guest at the right moment.
 */
export function useFootfall(initial: Order[], asOf: number, frozen: boolean, base: string): FootfallState {
  const [orders, setOrders] = useState(initial);
  const offset = useRef(0); // shop clock minus this browser's
  const since = useRef(new Date(asOf).toISOString());
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
          const r = await fetch(`${base}/api/v1/footfall?since=${encodeURIComponent(since.current)}`, { cache: "no-store" });
          if (r.ok) {
            const body = (await r.json()) as { asOf: string; guests: { placedAt: string; readyAt: string; items: number; source: Order["source"] }[] };
            offset.current = Date.parse(body.asOf) - Date.now();
            since.current = body.asOf;
            const cutoff = Date.parse(body.asOf) - KEEP_MS;
            const fresh = body.guests.map((g) => ({ placedAt: Date.parse(g.placedAt), readyAt: Date.parse(g.readyAt), items: g.items, source: g.source }));
            setOrders((old) => [...old.filter((o) => o.readyAt > cutoff), ...fresh]);
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

  return useMemo(() => ({ orders, drawnNow: () => Date.now() + offset.current - DRAW_DELAY_MS }), [orders]);
}

/** A peg person one unit tall, feet at the origin: the head, then the body tapering to the shoulders. */
const PEG_BODY = "M-.16 0 L-.13 -.6 Q-.13 -.71 0 -.71 Q.13 -.71 .13 -.6 L.16 0 Z";
const pegHead = (r = 0.125) => `M0 -.97 a${r} ${r} 0 1 0 .0001 0 Z`;

function makePeg(g: Timeline): SVGGElement {
  const el = document.createElementNS(NS, "g");
  el.setAttribute("class", `${s.peg} ${g.source === "visitor" ? s.visitor : ""}`);
  const title = document.createElementNS(NS, "title");
  const ready = new Date(g.readyAt).toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
  title.textContent = `${g.source === "visitor" ? "A real visitor's order" : "A simulated guest"} · ${g.items} item${g.items === 1 ? "" : "s"} · ready ${ready}`;
  // a soft shadow at the feet stands the peg on the floor; a pale halo under the ink outline keeps it
  // readable on the dark wood as well as the pale tile
  const shadow = document.createElementNS(NS, "ellipse");
  shadow.setAttribute("rx", ".22");
  shadow.setAttribute("ry", ".07");
  const under = document.createElementNS(NS, "path");
  const over = document.createElementNS(NS, "path");
  under.setAttribute("d", `${PEG_BODY} ${pegHead()}`);
  over.setAttribute("d", `${PEG_BODY} ${pegHead()}`);
  under.setAttribute("class", s.under!);
  el.append(title, shadow, under, over);
  return el;
}

/**
 * The guests on the model, in the render's own pixel space. One loop moves them all, by transform
 * only, and it stops when the model is off screen or the tab is hidden.
 */
export function GuestsLayer({ walk, state, width, height }: { walk: Walk; state: FootfallState; width: number; height: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const reduced = useReducedMotion();
  const timelines = useMemo(() => plan(state.orders, walk), [state.orders, walk]);

  useEffect(() => {
    const root = svg.current!;
    const pegs = new Map<string, SVGGElement>();
    let raf = 0, onScreen = true, order = "";
    const frame = () => {
      raf = 0;
      const t = state.drawnNow();
      const shown: { key: string; el: SVGGElement; y: number }[] = [];
      for (const g of timelines) {
        const pose = poseAt(g, t, reduced);
        let el = pegs.get(g.key);
        if (!pose) {
          if (el) {
            el.remove();
            pegs.delete(g.key);
          }
          continue;
        }
        if (!el) pegs.set(g.key, (el = makePeg(g)));
        const [fx, fy, , hy] = pose.spot;
        const h = fy - hy;
        // a little weight in the step: a hop and a sway while walking, still while waiting
        const step = pose.moving ? Math.abs(Math.sin(t / 170)) : 0;
        const sway = pose.moving ? Math.sin(t / 170) * 3 : 0;
        const from = reduced ? g.placedAt : g.start, to = reduced ? g.readyAt : g.end;
        const fade = Math.max(0, Math.min(1, (t - from) / 500, (to - t) / 500));
        el.setAttribute("transform", `translate(${fx.toFixed(1)} ${(fy - step * h * 0.035).toFixed(1)}) rotate(${sway.toFixed(2)}) scale(${h.toFixed(1)})`);
        el.style.opacity = fade.toFixed(2);
        shown.push({ key: g.key, el, y: fy });
      }
      // nearer guests (lower on the render) are drawn over farther ones
      shown.sort((a, b) => a.y - b.y);
      const next = shown.map((x) => x.key).join(",");
      if (next !== order) {
        order = next;
        for (const x of shown) root.append(x.el);
      }
      if (onScreen && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf && onScreen && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
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
      for (const el of pegs.values()) el.remove();
    };
  }, [timelines, reduced, state]);

  return <svg ref={svg} className={s.guests} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" />;
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
function useDrawnNow(state: FootfallState): number | null {
  const second = useSyncExternalStore(subscribeSecond, thisSecond, () => null);
  return second === null ? null : state.drawnNow();
}

/** Under the model: Austin's time on the model, the last quarter hour's orders and who's waiting. */
export function GuestCaption({ state, frozen }: { state: FootfallState; frozen: boolean }) {
  const t = useDrawnNow(state);
  if (frozen) {
    return <p className={`cond ${s.caption}`}>The clock is stopped, so the guests are too · simulated guests are cream, real visitors teal</p>;
  }
  const recent = t === null ? null : state.orders.filter((o) => o.placedAt > t - KEEP_MS && o.placedAt <= t).length;
  const waiting = t === null ? null : waitingAt(state.orders, t);
  return (
    <p className={`cond ${s.caption}`} aria-live="off">
      <span className={s.live}>{t === null ? "—" : clockFmt.format(t).toLowerCase()} in Austin</span>
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
  return <>{t === null ? "—" : waitingAt(state.orders, t)} on the rail</>;
}
