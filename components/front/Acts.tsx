"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FIXTURES, GROUPS, type FixtureKey } from "./fixtures";
import type { FixtureClaim } from "./Model";
import s from "./front.module.css";

/** The shop in three acts. */
export const ACTS = [{ title: "The shop" }, { title: "The numbers" }, { title: "How it’s built" }] as const satisfies readonly { title: string }[];

/**
 * The band over the model: three numbered tabs, and the act on show. Wide, the acts share one place
 * and the ones not on show are inert, so the keyboard and screen readers meet only the act in view;
 * the tabs reach the others. Narrower, the acts are ordinary sections under the stuck model.
 */
export function Acts({
  act,
  wide,
  go,
  shop,
  numbers,
  claims,
  picked,
  onPick,
  hot,
  onHot,
  card,
}: {
  act: number;
  wide: boolean;
  go: (i: number) => void;
  shop: ReactNode;
  numbers: ReactNode;
  claims: Partial<Record<FixtureKey, FixtureClaim>>;
  picked: FixtureKey | null;
  onPick: (k: FixtureKey | null) => void;
  hot: FixtureKey | null;
  onHot: (k: FixtureKey | null) => void;
  /** the picked fixture's card, which takes the band's place on a wide screen */
  card: ReactNode;
}) {
  // the band counts what it lists: the thirteen parts, and the ones not running yet
  const coming = FIXTURES.filter((f) => claims[f.key]?.status === "coming").length;
  const panel = (i: number, children: ReactNode) => (
    <div key={i} className={s.act} data-act={i} data-on={act === i ? "" : undefined} inert={wide && act !== i}>
      {children}
    </div>
  );

  return (
    <div className={s.band}>
      <nav className={s.tabs} aria-label="The shop in three parts">
        {ACTS.map((a, i) => (
          <button key={a.title} type="button" aria-current={act === i ? "step" : undefined} onClick={() => go(i)}>
            <span className={s.tabN} aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
            {a.title}
          </button>
        ))}
      </nav>
      <div className={s.acts} data-card={card ? "" : undefined}>
        {panel(0, shop)}
        {panel(1, numbers)}
        {panel(
          2,
          <>
            <div className={s.actHead}>
              <p className={`cond ${s.actKicker}`}>Every fixture is a working part</p>
              <h2 className={`block shade ${s.actTitle}`}>
                How it&rsquo;s built <span className="script">the lamp off, the parts lit</span>
              </h2>
              <p className={s.actLede}>
                <b>{FIXTURES.length - coming} of {FIXTURES.length}</b> parts are running, each one a line of the résumé.
                Point at a part to find it on the model; pick one for its proof.
              </p>
              <p className={`cond ${s.actLinks}`}>
                <Link href="/office">Every line, with its proof &rarr;</Link>
                <Link href="/docs">Read the API</Link>
              </p>
            </div>
            <div className={s.groups}>
              {GROUPS.map((g) => (
                <div key={g.title} className={s.group}>
                  <h3 className="cond">{g.title}</h3>
                  <ul>
                    {g.keys.map((k) => {
                      const i = FIXTURES.findIndex((f) => f.key === k);
                      const f = FIXTURES[i]!;
                      return (
                        <li key={k}>
                          <button
                            type="button"
                            data-coming={claims[k]?.status === "coming" ? "" : undefined}
                            data-hot={hot === k ? "" : undefined}
                            aria-pressed={picked === k}
                            onClick={() => onPick(picked === k ? null : k)}
                            onPointerEnter={() => onHot(k)}
                            onPointerLeave={() => onHot(null)}
                            onFocus={() => onHot(k)}
                            onBlur={() => onHot(null)}
                          >
                            <span className={s.n} aria-hidden="true">{i + 1}</span>
                            <span className={s.partName}>{f.title.replace(/^The /, "")}</span>
                            {/* what it is shows on its bead's tooltip; here it's only for a screen reader */}
                            <span className="visually-hidden">
                              , {f.tech}
                              {claims[k]?.status === "coming" && ", coming"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {coming > 0 && (
                <p className={s.comingNote}>
                  <span className={s.n} data-coming="" aria-hidden="true" /> a dashed bead is still on the way
                </p>
              )}
            </div>
          </>,
        )}
        {card && <div className={s.cardDock}>{card}</div>}
      </div>
    </div>
  );
}
