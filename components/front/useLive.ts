"use client";

import { useEffect, useRef, useState } from "react";

/** Today's figures for the live charts under the model. Last week's day is history, so it never changes. */
export interface NumbersData {
  /** orders in each Austin hour, 0–23; hours still to come are null */
  hours: (number | null)[];
  /** the same weekday last week, every hour of it */
  lastWeekHours: number[];
  /** today's best sellers, most first, at most five */
  top: { name: string; qty: number }[];
  /** waits, placed to ready, in seconds: today so far and last week to the same time */
  wait: { p50: number | null; p95: number | null };
  lastWeekWait: { p50: number | null; p95: number | null };
  /** the shop's instant these figures run to */
  asOf: number;
}

/** The public API's own minute: its day routes are cached at the edge for 60 s, so asking more often gains nothing. */
const LIVE_MS = 60_000;

const hourIn = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", hourCycle: "h23" });

/**
 * The server's figures, then the public API's (the same three day routes anyone can call) once a
 * minute, while the charts are on show and the tab is visible. A failed poll keeps what's there.
 * `fresh` changes when this visitor has just ordered: the next ask goes at once (now, or as soon as
 * the charts are on show) and carries the stamp, so it steps past the edge's minute-old copy.
 */
export function useLive(initial: NumbersData, base: string, active: boolean, frozen: boolean, fresh = 0): NumbersData {
  const [data, setData] = useState(initial);
  const fetched = useRef(initial.asOf);
  const asked = useRef(0); // the last `fresh` a request carried

  useEffect(() => {
    if (frozen || !active) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stop) return;
      if (document.visibilityState === "visible") {
        try {
          const stamp = fresh > asked.current ? fresh : 0;
          asked.current = Math.max(asked.current, fresh);
          const get = async (path: string) => {
            const r = await fetch(`${base}/api/v1/days/today${path}${stamp ? `?fresh=${stamp}` : ""}`);
            if (!r.ok) throw new Error(String(r.status));
            return r.json();
          };
          const [day, hours, items] = (await Promise.all([get(""), get("/hours"), get("/items")])) as [
            { asOf: string; waitP50Seconds: number | null; waitP95Seconds: number | null },
            { hours: { hour: number; orders: number }[] },
            { items: { name: string; qty: number }[] },
          ];
          const asOf = Date.parse(day.asOf);
          const now = Number(hourIn.format(asOf));
          const byHour = Array.from({ length: 24 }, (_, h): number | null => (h <= now ? 0 : null));
          for (const h of hours.hours) byHour[h.hour] = h.orders;
          fetched.current = Date.now();
          if (!stop) {
            setData((d) => ({
              ...d,
              hours: byHour,
              top: items.items.slice(0, 5).map(({ name, qty }) => ({ name, qty })),
              wait: { p50: day.waitP50Seconds, p95: day.waitP95Seconds },
              asOf,
            }));
          }
        } catch {
          // the charts keep the last figures they had; the stamp says how old they are
        }
      }
      if (!stop) timer = setTimeout(poll, LIVE_MS);
    };
    // coming back to the act after a while, or just after ordering, asks at once; otherwise on the minute
    const due = fresh > asked.current ? 0 : LIVE_MS - (Date.now() - fetched.current);
    timer = setTimeout(poll, Math.max(0, due));
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [active, frozen, base, fresh]);

  return data;
}
