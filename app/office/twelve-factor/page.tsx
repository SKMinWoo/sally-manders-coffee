import type { Metadata } from "next";
import Link from "next/link";
import { codeUrl, FACTORS } from "@/server/office";
import office from "../office.module.css";
import s from "./twelve-factor.module.css";

export const metadata: Metadata = { title: "The twelve factors" };

export default function TwelveFactor() {
  const short = FACTORS.filter((f) => f.gap).length;
  return (
    <main>
      <div className="wall-band">
        <p className="cond">
          <Link href="/office">Résumé, running</Link> · Exhibit 05 · {FACTORS.length - short} met, {short} with a gap
        </p>
      </div>
      <section className={office.head}>
        <h1 className={`script ${office.title}`}>The twelve factors</h1>
        <p className={office.lede}>
          The <a href="https://12factor.net">twelve-factor</a> rules for a service that deploys cleanly and scales by adding
          copies, each beside what the shop does about it and the files that show it. Where the shop falls short, the
          factor says so: a small app on Vercel meets some of them differently from GM&rsquo;s services on Kubernetes.
        </p>
      </section>
      <ol className={s.factors}>
        {FACTORS.map((f) => (
          <li key={f.n} className={s.factor}>
            <p className={`block ${s.n}`} aria-hidden>{String(f.n).padStart(2, "0")}</p>
            <div className={s.body}>
              <h2 className={`block ${s.name}`}>
                <span className="visually-hidden">{f.n}. </span>
                {f.name}
              </h2>
              <p className={s.asks}>{f.asks}</p>
              <p>{f.here}</p>
              {f.gap && (
                <p className={s.gap}>
                  <span className={`cond ${s.gapLabel}`}>Short of it</span> {f.gap}
                </p>
              )}
              <ul className={s.evidence}>
                {f.evidence.map((e) => <li key={e.label}><a href={codeUrl(e.path)}>{e.label}</a></li>)}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
