import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { shopDb } from "@/server/platform/db/client";
import type { Role } from "@/server/office";
import { engineering, SITE, type Chart, type ClaimReport, type Figure } from "@/server/office";
import s from "./office.module.css";
import { now } from "@/server/platform/clock";

export const metadata: Metadata = { title: "The back office" };

const ROLES: { role: Role; title: string; years: string }[] = [
  { role: "Full-Stack Software Engineer", title: "Full-stack", years: "General Motors · 2022 – now" },
  { role: "Software Development Engineer in Test", title: "Test engineer", years: "General Motors · 2019 – 2022" },
];

/** The résumé's `**bold**` as <b>, the rest as text. */
function Bullet({ text }: { text: string }) {
  return <>{text.split(/\*\*(.+?)\*\*/).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

function Measured({ f, lead = "Measured" }: { f: Figure; lead?: string }) {
  if (f.source === "live") return <>Counted just now</>;
  return (
    <>
      {lead} {when(f.measuredAt)} by <a href={f.runUrl!}>this run</a> at{" "}
      <a href={`${f.runUrl!.replace(/\/actions\/runs\/\d+$/, "")}/commit/${f.sha}`}><code>{f.sha!.slice(0, 7)}</code></a>
    </>
  );
}

/** A ranked bar per thing, its value printed at the end, the first (the worst) in red. */
function Bars({ chart }: { chart: Chart }) {
  const max = Math.max(1, ...chart.bars.map((b) => b.value));
  return (
    <figure className={s.chart}>
      <figcaption className={s.chartTitle}>{chart.title}</figcaption>
      <ol className={s.bars}>
        {chart.bars.map((b, i) => (
          <li key={b.label} className={i === 0 ? s.worst : undefined}>
            <code className={s.barLabel}>{b.label}</code>
            <span className={s.bar} style={{ "--w": `${(b.value / max) * 100}%` } as CSSProperties} aria-hidden />
            <span className={s.barValue}>{b.display}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/** The bullet's headline figure, the first **bold** in it, for the tally. */
const gmLead = (gm: string) => /\*\*(.+?)\*\*/.exec(gm)?.[1] ?? gm.split(/[,—]/)[0]!;

/** A figure's label without its asides, so the tally keeps to one line: the bracket goes, and a
 *  long label stops at its first comma. */
function shortLabel(label: string) {
  const plain = label.split(/\s*\(/)[0]!;
  return plain.length > 40 ? plain.split(/,\s*/)[0]! : plain;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Every claim on one check: GM's figure against the one measured here, each line a link to its card. */
function Tally({ claims }: { claims: ClaimReport[] }) {
  return (
    <section className={s.tally} aria-labelledby="tally-title">
      <h2 id="tally-title" className={s.tallyTitle}>At a glance</h2>
      <p className={s.tallyHead} aria-hidden>
        <span>At General Motors</span>
        <span>Here, measured</span>
      </p>
      <ol>
        {claims.map((c, i) => {
          const f = c.figures[0];
          return (
            <li key={c.id}>
              <a href={`#${c.id}`}>
                <span className={s.tn}>{pad(i + 1)}</span>
                <span className={s.tgm}>{gmLead(c.gm)}</span>
                <span className={s.leader} aria-hidden />
                {f ? (
                  <span className={s.there}>
                    <b>{f.display}</b> <span>{shortLabel(f.label).toLowerCase()}</span>
                  </span>
                ) : (
                  <span className={`${s.there} ${s.waiting}`}>{c.status === "running" ? "First run pending" : "Coming"}</span>
                )}
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Running, but its first run on main hasn't posted a figure yet. */
const isPending = (c: ClaimReport) => c.status === "running" && c.figures.length === 0 && !c.chart;

/** A figure as set: the number full size and a one-word unit after it small ("11 moderate",
 *  "212 ms"), so five to a row never wrap. A verdict in words ("No bar set yet") is set smaller. */
function Value({ display }: { display: string }) {
  const m = /^([\d.,]+%?)\s+([A-Za-z]+)$/.exec(display);
  if (m) return <dd className={s.figure}>{m[1]}<span className={s.unit}>{m[2]}</span></dd>;
  return <dd className={/\d/.test(display) ? s.figure : `${s.figure} ${s.verdict}`}>{display}</dd>;
}

function Card({ c, n }: { c: ClaimReport; n: number }) {
  const running = c.status === "running";
  const pending = isPending(c);
  // when one run measured every figure on the card, say so once, under them all
  const oneRun = c.figures.length > 1 && c.figures.every((f) => f.source === "ci" && f.runUrl === c.figures[0]!.runUrl);
  return (
    <li id={c.id} className={running ? s.running : s.coming}>
      <p className={s.no}>
        <span>No. {pad(n)}</span>
        <span className={pending ? `${s.status} ${s.pending}` : s.status}>{pending ? "First run pending" : running ? "Running" : "Coming"}</span>
      </p>
      {/* GM's line and the shop's side by side, the way the page sets them out */}
      <div className={s.pair}>
        <blockquote className={s.gm}>
          <p className={s.where}>At General Motors</p>
          <p><Bullet text={c.gm} /></p>
        </blockquote>
        <div>
          <p className={s.here}>{running ? "Here, running:" : "Here, next:"}</p>
          <p className={s.twin}>{c.headline ?? c.twin}</p>
          {c.headline && (
            <details className={s.more}>
              <summary>How it runs</summary>
              <p>{c.twin}</p>
            </details>
          )}
        </div>
      </div>
      {c.figures.length > 0 && (
        <dl className={s.figures} style={{ "--n": Math.min(c.figures.length, 5) } as CSSProperties}>
          {c.figures.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <Value display={f.display} />
              {!oneRun && <dd className={s.measured}><Measured f={f} /></dd>}
            </div>
          ))}
        </dl>
      )}
      {c.chart && <Bars chart={c.chart} />}
      {oneRun && <p className={s.measured}><Measured f={c.figures[0]!} lead="All measured" /></p>}
      {c.code.length > 0 && (
        <ul className={s.code}>
          {c.code.map((x) => (
            <li key={x.url}>
              {/* a page of this site opens here, wherever the site is running */}
              {x.url.startsWith(`${SITE}/`) ? <Link href={x.url.slice(SITE.length)}>{x.label}</Link> : <a href={x.url}>{x.label}</a>}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function Office() {
  await connection();
  const e = await engineering(await shopDb(), now());
  // the band counts what the cards say: measured, waiting on a first run, still to come
  const pending = e.claims.filter(isPending).length;
  const measured = e.claims.filter((c) => c.status === "running").length - pending;
  const coming = e.claims.length - measured - pending;
  // numbered in the order they're read: by role, then as the résumé lists them
  const ordered = ROLES.flatMap((r) => e.claims.filter((c) => c.role === r.role));
  return (
    <main>
      <div className="wall-band">
        <p className="cond">
          The back office · {measured} of {e.claims.length} measured
          {pending > 0 && ` · ${pending} first run pending`}
          {coming > 0 && ` · ${coming} coming`}
        </p>
      </div>
      <section className={s.head}>
        <h1 className={`script ${s.title}`}>The back office</h1>
        <p className={s.lede}>
          Each line of the résumé from General Motors, beside the small version of it that runs here. A figure on this
          page is either counted as you load it or posted by the CI run that measured it, linked, so none of it is typed
          in. Where the shop&rsquo;s version is smaller than GM&rsquo;s, the card says so. The same report is{" "}
          <Link href="/docs">in the API</Link> as <code>/api/v1/engineering</code>.
        </p>
      </section>
      <Tally claims={ordered} />
      {ROLES.map((r) => (
        <section key={r.role} className={s.role} aria-labelledby={`role-${r.title}`}>
          <h2 id={`role-${r.title}`} className={s.h2}>
            <span className="block">{r.title}</span>
            <span className={`cond ${s.years}`}>{r.years}</span>
          </h2>
          <ul className={s.cards}>
            {ordered.map((c, i) => c.role === r.role && <Card key={c.id} c={c} n={i + 1} />)}
          </ul>
        </section>
      ))}
    </main>
  );
}
