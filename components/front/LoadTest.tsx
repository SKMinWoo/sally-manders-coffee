import beauty from "@/public/cutaway/hero-beauty.webp";
import cutaway from "./cutaway.json";
import type { Meta } from "./Model";
import s from "./front.module.css";

const RUNS = "https://github.com/SKMinWoo/sally-manders-coffee/actions/runs";
const meta = cutaway as unknown as Meta;

/** A peg person one unit tall, feet at the origin (the same figure the live guests use). */
const PEG = "M-.16 0 L-.13 -.6 Q-.13 -.71 0 -.71 Q.13 -.71 .13 -.6 L.16 0 Z M0 -.97 a.125 .125 0 1 0 .0001 0 Z";

/**
 * The load test's finding as a still, not a scenario: the dining room at the run's peak, every
 * seat taken, a line out of the door, and the request Postgres turned away. It sits on /office
 * beside the exhibit it illustrates.
 */
export function LoadTest() {
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
        <image href={beauty.src} x="0" y="0" width={W} height={H} />
        {/* a seat's spot carries the 1.6 m mark like every other; a peg in a chair's socket stands 1.02 m
            above the seat, and one at the window ledge stands at full height */}
        {meta.seats.map(([fx, fy, , hy], i) =>
          peg(fx, fy, (fy - hy) * (meta.world.chairs[i]?.kind === "ledge" ? 1 : 0.64), s.stillPeg!, `seat-${i}`),
        )}
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
