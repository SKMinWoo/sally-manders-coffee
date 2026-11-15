"use client";

import { useEffect, useState } from "react";
import { CART_KEY } from "../cart";
import s from "../order.module.css";

/**
 * Counts down to `readyAt` in the browser, no polling. The server sends its own clock as
 * `serverNow`, so a visitor whose clock is off by minutes still sees the right wait:
 * remaining = readyAt − serverNow − (time since this page mounted).
 */
export function Countdown({ readyAt, serverNow }: { readyAt: number; serverNow: number }) {
  const [left, setLeft] = useState(() => Math.max(0, readyAt - serverNow));

  useEffect(() => {
    try {
      sessionStorage.removeItem(CART_KEY); // the check is on the rail now; the order page starts fresh
    } catch {}
    const mounted = performance.now();
    const tick = () => setLeft(Math.max(0, readyAt - serverNow - (performance.now() - mounted)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [readyAt, serverNow]);

  if (left <= 0) return <p className={s.up} role="status">Up! At the counter</p>;
  const secs = Math.ceil(left / 1000);
  return (
    <div role="timer" aria-live="off">
      <p className={s.label}>Ready in</p>
      <p className={s.clock}>
        {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
      </p>
    </div>
  );
}
