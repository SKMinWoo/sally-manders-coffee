"use client";

import { useState, type ReactNode } from "react";
import { formatWait } from "@/lib/time";
import { useDrawnNow, type FootfallState } from "./Guests";
import { useLive, type NumbersData } from "./useLive";
import s from "./front.module.css";

const clockFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** A small hover note over one mark; the hidden tables carry the same figures for screen readers. */
type Tip = { x: number; text: string } | null;

function Chart({ title, aside, tip, table, children }: { title: string; aside?: ReactNode; tip: Tip; table: ReactNode; children: ReactNode }) {
  return (
    <figure className={s.chart}>
      <figcaption className={s.chartHead}>
        <span className="cond">{title}</span>
        {aside}
      </figcaption>
      <div className={s.plot}>
        {children}
        {tip && (
          <span className={s.chartTip} style={{ left: `${tip.x}%`, ["--x" as string]: `${tip.x}%` }} role="presentation">
            {tip.text}
          </span>
        )}
      </div>
      <table className="visually-hidden">{table}</table>
    </figure>
  );
}

/** Today's orders by hour, bars, against the same weekday last week, a tick on each hour. */
function ByHour({ d }: { d: NumbersData }) {
  const [tip, setTip] = useState<Tip>(null);
  // the shop's hours: wherever either day had an order, so the axis doesn't spend half itself on the night
  const open = d.lastWeekHours.map((n, h) => n > 0 || (d.hours[h] ?? 0) > 0);
  const first = Math.max(0, open.indexOf(true)), last = Math.max(first, open.lastIndexOf(true));
  const span = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...span.map((h) => Math.max(d.hours[h] ?? 0, d.lastWeekHours[h]!)));
  const H = 60, W = span.length * 10;
  return (
    <Chart
      title="Orders by hour"
      tip={tip}
      table={
        <>
          <caption>Orders in each hour today, and on the same weekday last week</caption>
          <thead><tr><th>Hour</th><th>Today</th><th>Last week</th></tr></thead>
          <tbody>{span.map((h) => <tr key={h}><td>{hourLabel(h)}</td><td>{d.hours[h] ?? "to come"}</td><td>{d.lastWeekHours[h]}</td></tr>)}</tbody>
        </>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" onPointerLeave={() => setTip(null)}>
        <line x1="0" x2={W} y1={H} y2={H} className={s.axis} />
        {span.map((h, i) => {
          const today = d.hours[h];
          return (
            <g key={h}>
              {today !== null && today !== undefined && (
                <rect className={s.barUp} x={i * 10 + 2} y="0" width="6" height={H} style={{ transform: `scaleY(${today / max})` }} />
              )}
              <line className={s.tickLast} x1={i * 10 + 1} x2={i * 10 + 9} y1={H} y2={H} style={{ transform: `translateY(${(-d.lastWeekHours[h]! / max) * H}px)` }} />
              <rect
                className={s.hit}
                x={i * 10}
                y="0"
                width="10"
                height={H}
                onPointerEnter={() =>
                  setTip({ x: ((i + 0.5) / span.length) * 100, text: `${hourLabel(h)} · ${today ?? "—"} today · ${d.lastWeekHours[h]} last week` })
                }
              />
            </g>
          );
        })}
      </svg>
      <span className={s.axisLabels} aria-hidden="true">
        <span>{hourLabel(first)}</span>
        <span>{hourLabel(last)}</span>
      </span>
    </Chart>
  );
}

/** Arrivals a minute over the last quarter hour, from the guests the model is walking, and who's waiting. */
function LastQuarter({ state }: { state: FootfallState }) {
  const [tip, setTip] = useState<Tip>(null);
  const t = useDrawnNow(state);
  const bins = Array.from({ length: 15 }, () => 0);
  let waiting = 0;
  if (t !== null) {
    for (const o of state.orders) {
      const ago = Math.floor((t - o.placedAt) / 60_000);
      if (ago >= 0 && ago < 15) bins[14 - ago]! += 1;
      if (o.placedAt <= t && t < o.readyAt) waiting++;
    }
  }
  const max = Math.max(3, ...bins);
  const H = 60, W = 150;
  return (
    <Chart
      title="Last 15 minutes"
      aside={<span className={s.chartBig}>{t === null ? "—" : waiting}<small> waiting now</small></span>}
      tip={tip}
      table={
        <>
          <caption>Orders placed in each of the last 15 minutes, and how many are waiting now</caption>
          <thead><tr><th>Minutes ago</th><th>Orders</th></tr></thead>
          <tbody>{bins.map((n, i) => <tr key={i}><td>{14 - i}</td><td>{n}</td></tr>)}</tbody>
        </>
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true" onPointerLeave={() => setTip(null)}>
        <line x1="0" x2={W} y1={H} y2={H} className={s.axis} />
        {bins.map((n, i) => (
          <g key={i}>
            <rect className={s.barUp} x={i * 10 + 2} y="0" width="6" height={H} style={{ transform: `scaleY(${n / max})` }} />
            <rect
              className={s.hit}
              x={i * 10}
              y="0"
              width="10"
              height={H}
              onPointerEnter={() => setTip({ x: ((i + 0.5) / 15) * 100, text: `${14 - i === 0 ? "this minute" : `${14 - i} min ago`} · ${plural(n, "order")}` })}
            />
          </g>
        ))}
      </svg>
      <span className={s.axisLabels} aria-hidden="true">
        <span>15 min ago</span>
        <span>now</span>
      </span>
    </Chart>
  );
}

/** Today's five best sellers; when the order changes, the rows slide to their new places. */
function TopSellers({ d }: { d: NumbersData }) {
  const max = Math.max(1, ...d.top.map((x) => x.qty));
  return (
    <Chart
      title="Top sellers today"
      tip={null}
      table={
        <>
          <caption>Today&rsquo;s five best-selling items</caption>
          <thead><tr><th>Item</th><th>Sold</th></tr></thead>
          <tbody>{d.top.map((x) => <tr key={x.name}><td>{x.name}</td><td>{x.qty}</td></tr>)}</tbody>
        </>
      }
    >
      {d.top.length === 0 ? (
        <p className={s.chartEmpty}>Nothing sold yet today</p>
      ) : (
        <ol className={s.top} aria-hidden="true" style={{ height: `${d.top.length * 13}px` }}>
          {d.top.map((x, i) => (
            <li key={x.name} style={{ transform: `translateY(${i * 13}px)` }}>
              <span className={s.topName}>{x.name}</span>
              <span className={s.topTrack}>
                <span className={s.barRight} style={{ transform: `scaleX(${x.qty / max})` }} />
              </span>
              <span className={s.topQty}>{x.qty}</span>
            </li>
          ))}
        </ol>
      )}
    </Chart>
  );
}

/** The typical wait and the slowest one in twenty, today against last week to the same time. */
function Waits({ d }: { d: NumbersData }) {
  const vals = [d.wait.p50, d.wait.p95, d.lastWeekWait.p50, d.lastWeekWait.p95].filter((v): v is number => v !== null);
  const max = Math.max(60, ...vals) * 1.1;
  const rows = [
    { label: "Typical", today: d.wait.p50, last: d.lastWeekWait.p50 },
    { label: "Slowest 1 in 20", today: d.wait.p95, last: d.lastWeekWait.p95 },
  ];
  const at = (v: number) => ({ transform: `translateX(${(v / max - 1) * 100}%)` });
  return (
    <Chart
      title="Wait, order to ready"
      tip={null}
      table={
        <>
          <caption>Waits today against the same weekday last week, to the same time</caption>
          <thead><tr><th>Wait</th><th>Today</th><th>Last week</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td><td>{r.today === null ? "—" : formatWait(r.today)}</td><td>{r.last === null ? "—" : formatWait(r.last)}</td></tr>)}</tbody>
        </>
      }
    >
      <div className={s.waits} aria-hidden="true">
        {rows.map((r) => (
          <div key={r.label} className={s.waitRow}>
            <span className={s.waitLabel}>
              {r.label} <b>{r.today === null ? "—" : formatWait(r.today)}</b>
            </span>
            <span className={s.waitTrack}>
              {r.last !== null && (
                <span className={s.waitAt} style={at(r.last)} title={`Last week ${formatWait(r.last)}`}>
                  <i className={s.dotLast} />
                </span>
              )}
              {r.today !== null && (
                <span className={s.waitAt} style={at(r.today)} title={`Today ${formatWait(r.today)}`}>
                  <i className={s.dotToday} />
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </Chart>
  );
}

/**
 * "The numbers", drawn: four small charts along the bottom of the model, on today's real orders.
 * Three ask the public API once a minute; the quarter hour reads the guests the model is already
 * walking, so it moves with them.
 */
export function Charts({ initial, footfall, base, active, frozen, fresh }: { initial: NumbersData; footfall: FootfallState; base: string; active: boolean; frozen: boolean; fresh?: number }) {
  const d = useLive(initial, base, active, frozen, fresh);
  return (
    <section className={s.charts} aria-label="Today's numbers, live">
      <ByHour d={d} />
      <LastQuarter state={footfall} />
      <TopSellers d={d} />
      <Waits d={d} />
      <p className={`cond ${s.stamp}`}>
        <span className={s.live}>{frozen ? "Clock stopped" : "Live"}</span>
        <span>updated {clockFmt.format(d.asOf).toLowerCase()}</span>
        <span className={s.legend}>
          <i className={s.keyToday} aria-hidden="true" /> today <i className={s.keyLast} aria-hidden="true" /> same day last week
        </span>
        <span>a simulated shop</span>
      </p>
    </section>
  );
}
