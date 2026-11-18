"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { FIXTURES, PLATES, type FixtureKey } from "./fixtures";
import type { FixtureClaim, Meta } from "./Model";
import s from "./front.module.css";

const RUNS = "https://github.com/SKMinWoo/sally-manders-coffee/actions/runs";

/**
 * The three plates beside the model. The one in the middle of the screen lights its rooms on the
 * model; picking a row opens that fixture's card on the model.
 */
export function Floors({
  onActive,
  onPick,
  claims,
  extra,
  meta,
  beautySrc,
}: {
  onActive: (plate: number | null) => void;
  onPick: (k: FixtureKey) => void;
  claims: Partial<Record<FixtureKey, FixtureClaim>>;
  extra: Partial<Record<FixtureKey, React.ReactNode>>;
  meta: Meta;
  beautySrc: string;
}) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const inView = new Set<number>();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const i = Number((e.target as HTMLElement).dataset.plate);
          if (e.isIntersecting) inView.add(i);
          else inView.delete(i);
        }
        onActive(inView.size ? Math.min(...inView) : null);
      },
      { rootMargin: "-42% 0px -42% 0px" }, // the plate crossing the middle of the screen
    );
    for (const el of refs.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [onActive]);

  return (
    <div className={s.plates}>
      {PLATES.map((p, i) => (
        <section key={p.no} id={`plate-${i + 1}`} data-plate={i} ref={(el) => void (refs.current[i] = el)} className={s.plate} aria-labelledby={`plate-${i + 1}-title`}>
          <p className={`cond ${s.plateNo}`}>Plate {p.no}</p>
          <h2 id={`plate-${i + 1}-title`} className={s.plateTitle}>
            <span className="block">{p.title}</span> <span className="script">{p.script}</span>
          </h2>
          <p className={s.plateLede}>{p.lede}</p>
          <ul className={s.rows}>
            {p.keys.map((k) => {
              const f = FIXTURES.find((x) => x.key === k)!;
              const c = claims[k];
              const figure = extra[k] ?? (c?.status === "coming" ? null : c?.figure ? <>{c.figure.display} <small>{c.figure.label.toLowerCase()}</small></> : null);
              return (
                <li key={k}>
                  <button type="button" onClick={() => onPick(k)}>
                    <span className={s.n} aria-hidden="true">{FIXTURES.indexOf(f) + 1}</span>
                    <span className={s.rowName}>
                      <b>{f.title}</b>
                      <span>{f.tech}</span>
                      {figure && <span className={s.rowFigure}>{figure}</span>}
                    </span>
                    {c?.status === "coming" && <span className={s.coming}>Coming</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {i === 0 && (
            <p className={`cond ${s.plateLinks}`}>
              <Link href="/order">Order ahead</Link>
              <a href="#board">Today&rsquo;s board</a>
              <Link href="/docs">Read the API</Link>
            </p>
          )}
          {i === 1 && (
            <p className={s.plateNote}>
              Every guest on the model is an order the simulator wrote for today, at the moment it wrote it, and each
              one waits exactly as long as it says. Nobody is added to fill a quiet hour.
            </p>
          )}
          {i === 2 && <LoadTest meta={meta} beautySrc={beautySrc} />}
        </section>
      ))}
    </div>
  );
}

/** A peg person one unit tall, feet at the origin (the same figure the live guests use). */
const PEG = "M-.16 0 L-.13 -.6 Q-.13 -.71 0 -.71 Q.13 -.71 .13 -.6 L.16 0 Z M0 -.97 a.125 .125 0 1 0 .0001 0 Z";

/**
 * The load test's finding as a still, not a scenario: the dining room at the run's peak, every
 * seat taken, a line out of the door, and the request Postgres turned away.
 */
function LoadTest({ meta, beautySrc }: { meta: Meta; beautySrc: string }) {
  const [W, H] = meta.size;
  const peg = (fx: number, fy: number, h: number, cls: string, key: string) => (
    <g key={key} className={cls} transform={`translate(${fx} ${fy}) scale(${h})`}>
      <path className={s.under} d={PEG} />
      <path d={PEG} />
    </g>
  );
  const walk = meta.walk;
  const queue = Object.keys(walk).filter((k) => k.startsWith("queue-")).map((k) => walk[k]!);
  const refused = walk.refused!;
  // crop to the dining room and the line outside its door, from the model's own points, so a
  // re-render can't leave the crop pointing at the wrong room
  const pts = [...meta.zones.dining!, ...queue.map(([x, y]) => [x, y] as const), [refused[0], refused[1]] as const];
  const PAD = 40;
  const x0 = Math.max(0, Math.min(...pts.map((p) => p[0])) - PAD), x1 = Math.min(W, Math.max(...pts.map((p) => p[0])) + PAD);
  const y0 = Math.max(0, Math.min(...pts.map((p) => p[1])) - PAD * 2.5), y1 = Math.min(H, Math.max(...pts.map((p) => p[1])) + PAD);
  const view = [x0, y0, x1 - x0, y1 - y0].map(Math.round);
  return (
    <figure className={s.still}>
      <svg viewBox={view.join(" ")} role="img" aria-label="The dining room at the load test's peak: all twelve seats taken, eight guests queued on the sidewalk, and one turned away in red at the door.">
        <image href={beautySrc} x="0" y="0" width={W} height={H} />
        {meta.seats.map(([fx, fy, , hy], i) => peg(fx, fy, (fy - hy) * 1.25, s.stillPeg!, `seat-${i}`))}
        {[...queue].reverse().map(([fx, fy, , hy], i) => peg(fx, fy, fy - hy, s.stillPeg!, `queue-${i}`))}
        {peg(refused[0], refused[1], refused[1] - refused[3], `${s.stillPeg} ${s.refused}`, "refused")}
      </svg>
      <figcaption>
        <dl className={s.findings}>
          <div><dt>Simulated visitors, three minutes</dt><dd>20</dd></div>
          <div><dt>Requests a second, flat out</dt><dd>11.4</dd></div>
          <div><dt>Refused: &ldquo;too many clients&rdquo;</dt><dd>4</dd></div>
        </dl>
        <p>
          Each seat stands for a connection to Postgres. Under load they ran out first: four requests for{" "}
          <code>/office</code>, the page that asks the most of the pantry at once, were turned away. The cause was
          the test rig, not the shop: its proxy opened a fresh connection for every query. Pooling is on now; the
          re-run is pending.
        </p>
        <p className={`cond ${s.source}`}>
          From CI runs <a href={`${RUNS}/43810056969`}>43810056969</a> and <a href={`${RUNS}/43814199719`}>43814199719</a>, 15 Nov
          2026, in an open pull request · never run against the live shop · twelve seats is illustrative: the runs
          didn&rsquo;t record Postgres&rsquo;s connection limit
        </p>
      </figcaption>
    </figure>
  );
}
