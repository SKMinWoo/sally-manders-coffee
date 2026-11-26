import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { shopDb } from "@/server/platform/db/client";
import type { Role } from "@/server/office";
import { engineering, SITE, type Chart, type ClaimReport, type Figure } from "@/server/office";
import { LoadTest } from "@/components/front/LoadTest";
import { ExhibitVisual } from "@/components/office/ExhibitVisual";
import s from "./office.module.css";
import { now } from "@/server/platform/clock";

export const metadata: Metadata = { title: "Résumé, running" };

const ROLES: { role: Role; title: string; years: string }[] = [
  { role: "Full-Stack Software Engineer", title: "Full-stack", years: "General Motors · 2022 – now" },
  { role: "Software Development Engineer in Test", title: "Test engineer", years: "General Motors · 2019 – 2022" },
];

/** Each claim's name in the index: what it is, in a few plain words. */
const NAMES: Record<string, string> = {
  "full-stack": "Self-service tools",
  "excel-export": "Server-side Excel export",
  performance: "Load test and p95",
  aks: "Cloud deploys",
  "re-architecture": "Twelve-factor app",
  devsecops: "Supply chain and coverage",
  "ai-adoption": "An LLM in production",
  barcode: "Barcode validation",
  "ui-tests": "Automated UI tests",
  "quality-gates": "Regression baselines",
  "zero-downtime": "Zero-downtime releases",
};

const flat = (t: string) => t.replace(/\*\*/g, "");

/**
 * A bullet that backs more than one claim, cut to the clause this claim answers: its lead-in, then the
 * one part (between semicolons) that holds the bold. The whole bullet stays one tap away.
 */
function clause(gm: string): { lead: string; part: string; before: boolean; after: boolean } | null {
  const m = /^([^:]+):\s([\s\S]*)$/.exec(gm);
  if (!m) return null;
  const parts = m[2]!.replace(/\.$/, "").split(/;\s/);
  const i = parts.findIndex((p) => p.includes("**"));
  if (parts.length < 2 || i < 0) return null;
  return { lead: m[1]!, part: parts[i]!, before: i > 0, after: i < parts.length - 1 };
}

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

function Clause({ gm }: { gm: string }) {
  const k = clause(gm)!;
  return (
    <>
      <p>
        {k.lead}: {k.before && "… "}
        <Bullet text={k.part} />
        {k.after && " …"}
      </p>
      <details className={s.whole}>
        <summary>The whole line</summary>
        <p>{flat(gm)}</p>
      </details>
    </>
  );
}

function Card({ c, no, shared }: { c: ClaimReport; no: number; shared: boolean }) {
  const running = c.status === "running";
  // when one run measured every figure on the card, say so once, under them all
  const oneRun = c.figures.length > 1 && c.figures.every((f) => f.source === "ci" && f.runUrl === c.figures[0]!.runUrl);
  return (
    <li id={c.id} className={running ? s.running : s.coming}>
      <p className={s.no}>
        <span>Exhibit {String(no).padStart(2, "0")}</span>
        <span className={s.status}>{running ? "Running" : "Coming"}</span>
      </p>
      <blockquote className={s.gm}>
        <p className={s.where}>At General Motors</p>
        {shared && clause(c.gm) ? (
          <Clause gm={c.gm} />
        ) : (
          <p><Bullet text={c.gm} /></p>
        )}
      </blockquote>
      <p className={s.here}>{running ? "Here, running:" : "Here, next:"}</p>
      <p className={s.twin}>{c.twin}</p>
      <ExhibitVisual v={c.visual} />
      {c.figures.length > 0 && (
        <dl className={s.figures}>
          {c.figures.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              {/* a verdict in words ("Passed", "No bar set yet") is set smaller than a number */}
              <dd className={/\d/.test(f.display) ? s.figure : `${s.figure} ${s.verdict}`}>{f.display}</dd>
              {!oneRun && <dd className={s.measured}><Measured f={f} /></dd>}
            </div>
          ))}
        </dl>
      )}
      {c.chart && <Bars chart={c.chart} />}
      {oneRun && <p className={s.measured}><Measured f={c.figures[0]!} lead="All measured" /></p>}
      {/* the load test as the model shows it: the dining room at the run's peak */}
      {c.id === "performance" && <LoadTest />}
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
  const running = e.claims.filter((c) => c.status === "running").length;
  // the exhibits are numbered in the page's order: by role, then as the résumé lists them
  const ordered = [...e.claims].sort((a, b) => a.exhibit - b.exhibit);
  const no = (c: ClaimReport) => c.exhibit;
  // a bullet that backs more than one claim is cut to each one's clause, so no two cards read the same
  const shared = (c: ClaimReport) => e.claims.filter((x) => flat(x.gm) === flat(c.gm)).length > 1;
  return (
    <main>
      <div className="wall-band">
        <p className="cond">Résumé, running · {running} of {e.claims.length} running</p>
      </div>
      <section className={s.head}>
        <div>
          <h1 className={`script ${s.title}`}>Résumé, running</h1>
          <p className={s.lede}>
            My GM résumé, running: <b>{running} of {e.claims.length}</b> claims live, measured by CI. Each line from
            General Motors sits beside the small version of it that runs here. A figure on this page is either counted
            as you load it or posted by the CI run that measured it, linked, so none of it is typed in. Where the
            shop&rsquo;s version is smaller than GM&rsquo;s, the card says so. The same report is{" "}
            <Link href="/docs">in the API</Link> as <code>/api/v1/engineering</code>.
          </p>
        </div>
        <nav className={s.index} aria-label="The claims">
          <ol>
            {ordered.map((c) => (
              <li key={c.id} data-coming={c.status === "coming" ? "" : undefined}>
                <a href={`#${c.id}`}>
                  <span className={s.indexNo}>{String(no(c)).padStart(2, "0")}</span>
                  {NAMES[c.id] ?? c.id}
                  <span className={s.indexStatus}>{c.status === "running" ? "Running" : "Coming"}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </section>
      {ROLES.map((r) => (
        <section key={r.role} className={s.role} aria-labelledby={`role-${r.title}`}>
          <h2 id={`role-${r.title}`} className={s.h2}>
            <span className="block">{r.title}</span>
            <span className={`cond ${s.years}`}>{r.years}</span>
          </h2>
          <ul className={s.cards}>
            {ordered.filter((c) => c.role === r.role).map((c) => <Card key={c.id} c={c} no={no(c)} shared={shared(c)} />)}
          </ul>
        </section>
      ))}
    </main>
  );
}
