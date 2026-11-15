import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { shopDb } from "@/server/db/client";
import type { Role } from "@/server/office/claims";
import { engineering, type ClaimReport, type Figure } from "@/server/office/engineering";
import s from "./office.module.css";

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

function Card({ c }: { c: ClaimReport }) {
  const running = c.status === "running";
  // when one run measured every figure on the card, say so once, under them all
  const oneRun = c.figures.length > 1 && c.figures.every((f) => f.source === "ci" && f.runUrl === c.figures[0]!.runUrl);
  return (
    <li className={running ? s.running : s.coming}>
      <p className={s.no}>
        <span>Exhibit {String(c.exhibit).padStart(2, "0")}</span>
        <span className={s.status}>{running ? "Running" : "Coming"}</span>
      </p>
      <blockquote className={s.gm}>
        <p className={s.where}>At General Motors</p>
        <p><Bullet text={c.gm} /></p>
      </blockquote>
      <p className={s.here}>{running ? "Here, running:" : "Here, next:"}</p>
      <p className={s.twin}>{c.twin}</p>
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
      {oneRun && <p className={s.measured}><Measured f={c.figures[0]!} lead="All measured" /></p>}
      {c.code.length > 0 && (
        <ul className={s.code}>
          {c.code.map((x) => <li key={x.url}><a href={x.url}>{x.label}</a></li>)}
        </ul>
      )}
    </li>
  );
}

export default async function Office() {
  await connection();
  const e = await engineering(await shopDb(), new Date());
  const running = e.claims.filter((c) => c.status === "running").length;
  return (
    <main>
      <div className="wall-band">
        <p className="cond">The back office · {running} of {e.claims.length} running</p>
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
      {ROLES.map((r) => (
        <section key={r.role} className={s.role} aria-labelledby={`role-${r.title}`}>
          <h2 id={`role-${r.title}`} className={s.h2}>
            <span className="block">{r.title}</span>
            <span className={`cond ${s.years}`}>{r.years}</span>
          </h2>
          <ul className={s.cards}>
            {e.claims.filter((c) => c.role === r.role).map((c) => <Card key={c.id} c={c} />)}
          </ul>
        </section>
      ))}
    </main>
  );
}
