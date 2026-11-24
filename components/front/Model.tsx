"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type { Walk, World } from "@/lib/footfall";
import { FIXTURES, type Fixture, type FixtureKey } from "./fixtures";
import { GuestsLayer, type FootfallState } from "./Guests";
import type { Occluders, PegMeta } from "./pegs";
import { ROOF_COOKIE } from "./roof";
import { ExhibitVisual } from "@/components/office/ExhibitVisual";
import type { Visual } from "@/server/office";
import s from "./front.module.css";

/** The renders' sizes for next/image: the model is most of a wide screen's width, all of a narrow one's. */
const SIZES = "(max-width: 1000px) 100vw, 90vw";
/** Above the default 75: the renders' painted grain and the pegs' faces soften visibly at 75. */
const QUALITY = 90;

export interface Meta {
  size: [number, number];
  anchors: Record<string, [number, number]>;
  walk: Walk;
  seats: [number, number, number, number][];
  zones: Record<string, [number, number][]>;
  /** the guests' peg sprites: their size, and where the feet and the 1.6 m mark fall in them */
  peg: PegMeta;
  /** the floor plan behind the render: the camera, the walking graph, the chairs and the obstacles */
  world: World;
  /** everything a figure can pass behind, cut from the render (pegs.ts's atlases) */
  occluders: Occluders;
}

/** A fixture's figure as the card prints it: from its card on /office, or none yet. */
export interface FixtureFigure {
  label: string;
  display: string;
}
export interface FixtureClaim {
  status: "running" | "coming";
  exhibit: number;
  figure: FixtureFigure | null;
  /** the exhibit's proof, drawn small; null until it has measured something */
  visual: Visual | null;
}

/** "guests": the lamp on, nothing pinned. "built": the lamp off and every fixture's bead out. */
export type View = "guests" | "built";

const pct = (v: number, of: number) => `${((100 * v) / of).toFixed(3)}%`;

export function Model({
  meta,
  beauty,
  dark,
  roof,
  closed,
  lift,
  view,
  picked,
  onPick,
  hot,
  onHot,
  coming,
  footfall,
}: {
  meta: Meta;
  beauty: StaticImageData;
  /** the same set with the reading lamp off, only its own bulbs lit: "How it's built" */
  dark: StaticImageData;
  roof: StaticImageData;
  /** the whole set, roof on, cropped from the Study's cut-out (portfolio scene.py --closed) */
  closed: StaticImageData;
  /** arrive roofed and lift it off (decided on the server: see roof.ts) */
  lift: boolean;
  view: View;
  picked: FixtureKey | null;
  onPick: (k: FixtureKey | null) => void;
  /** the fixture pointed at or focused, here or in the list beside the model: its bead shows its name */
  hot: FixtureKey | null;
  onHot: (k: FixtureKey | null) => void;
  /** the parts not running yet, whose beads are dashed */
  coming: readonly FixtureKey[];
  footfall: FootfallState;
}) {
  const [W, H] = meta.size;
  const [roofState, setRoof] = useState<"on" | "lifting" | "off">(lift ? "on" : "off");

  useEffect(() => {
    if (!lift) return;
    // Arriving by the Study's zoom, the roof waits for the set to land on the model and settle, then
    // a beat so the landing reads as its own moment; otherwise a beat to see the shop with its roof
    // on, then up it comes. Either way only once the page is revealed: page.tsx's ARRIVE script
    // catches that before React is here, and a page the Study pre-loaded mounts long before it.
    let id: ReturnType<typeof setTimeout> | undefined;
    let gone = false;
    const up = (after: number) => {
      if (!gone) id = setTimeout(() => setRoof("lifting"), after);
    };
    const arrival = (window as { __sallyArrival?: Promise<"landed" | "plain"> }).__sallyArrival ?? Promise.resolve("plain");
    void arrival.then((how) => up(how === "landed" ? 300 : 700));
    return () => {
      gone = true;
      clearTimeout(id);
    };
  }, [lift]);

  const lifted = () => {
    setRoof("off");
    document.cookie = `${ROOF_COOKIE}=1; path=/; SameSite=Lax`; // a session cookie: the rest of this visit arrives open
  };

  const built = view === "built";

  // The model is always seen whole and never covered: the beads are the only marks on it, each a
  // fixed point that names itself on hover, and the card a bead opens sits beside the model.
  return (
    <div className={built ? s.built : undefined}>
      {/* the Study's cut-out lands on this frame (the portfolio's ZoomLink names it the same): it is
          exactly the render at every width (narrow, wider than the column and shifted left), and it
          arrives showing the very file the Study flies in (hero-closed.webp), so the morph is one
          picture moving and scaling. Inline, so no CSS module can rename it out of step with the Study. */}
      <div className={s.stage} data-roof={roofState} style={{ viewTransitionName: "sally" }}>
        <div className={s.lens}>
          <div className={s.film}>
            <Image className={s.beauty} src={beauty} alt="A painted-wood model of Sally Mander's with the roof lifted off, standing on the page under a reading lamp: the café with its teal counter, two baristas in red aprons and caps, and menu boards on the right, a dining room with tables and pantry shelving in the middle, the back office on the left, and a toy van at the kerb." sizes={SIZES} quality={QUALITY} priority />
            {/* the lamp goes off for "How it's built": the set lit only by its own bulbs and the street lamp */}
            <Image className={s.dark} src={dark} alt="" sizes={SIZES} quality={QUALITY} />
            <GuestsLayer world={meta.world} occluders={meta.occluders} state={footfall} width={W} height={H} peg={meta.peg} />
          </div>
        </div>
        {roofState !== "off" && (
          <Image
            className={`${s.roof} ${roofState === "lifting" ? s.lifting : ""}`}
            src={roof}
            alt=""
            sizes={SIZES}
            quality={QUALITY}
            priority
            onAnimationEnd={lifted}
          />
        )}
        {/* the set as it stands, roof on and casting the roof's own shadow: the very file the Study's
            zoom flies in, so the page change swaps a picture for the same picture. It lets go as the
            roof starts up, taking the roof's shadow with it. `data-arrives`: the Study's cut-out
            waits for this picture before letting go (app/page.tsx) */}
        {roofState !== "off" && (
          <Image
            data-arrives=""
            className={`${s.closed} ${roofState === "lifting" ? s.opening : ""}`}
            src={closed}
            alt=""
            sizes={SIZES}
            quality={QUALITY}
            priority
          />
        )}
        {/* The beads: a painted bead per fixture that never moves. Its name is a tooltip that takes no
            pointer, so pointing at a bead can't shift what's under the pointer (the old tags grew into
            cards on hover and slid out from under it, which made hover flicker) */}
        {built &&
          FIXTURES.map((f, i) => {
            const n = i + 1;
            const [x, y] = meta.anchors[f.key]!;
            return (
              <button
                key={f.key}
                type="button"
                className={s.bead}
                data-key={f.key}
                data-edge={x / W > 0.72 ? "end" : x / W < 0.2 ? "start" : undefined}
                data-hot={hot === f.key ? "" : undefined}
                data-coming={coming.includes(f.key) ? "" : undefined}
                style={{ left: pct(x, W), top: pct(y, H) }}
                aria-pressed={picked === f.key}
                aria-label={`${n}. ${f.title}, ${f.tech}${coming.includes(f.key) ? ", coming" : ""}`}
                onClick={() => onPick(picked === f.key ? null : f.key)}
                onPointerEnter={() => onHot(f.key)}
                onPointerLeave={() => onHot(null)}
                onFocus={() => onHot(f.key)}
                onBlur={() => onHot(null)}
              >
                <span className={s.beadN} aria-hidden="true">{n}</span>
                <span className={s.tip} aria-hidden="true">
                  <b>{f.title}</b>
                  <i>{f.tech}</i>
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}

/** The card a bead (or its line in the list) opens: what the fixture stands for, and its proof. */
export function Card({
  f,
  x,
  claim,
  extra,
  onClose,
}: {
  f: Fixture;
  /** where its fixture sits across the model, 0..1: the notch points there */
  x: number;
  claim: FixtureClaim | undefined;
  extra: React.ReactNode;
  onClose: () => void;
}) {
  const style = { "--x": pct(x, 1) } as CSSProperties;
  return (
    <div className={s.card} style={style} role="dialog" aria-labelledby="fixture-title">
      <button type="button" className={s.close} onClick={onClose} aria-label="Close">×</button>
      <div className={s.cardHead}>
        <p className={`cond ${s.cardTech}`}>
          {String(FIXTURES.indexOf(f) + 1).padStart(2, "0")} · {f.tech}
        </p>
        <h3 id="fixture-title">{f.title}</h3>
      </div>
      <div className={s.cardBody}>
        <p>{f.blurb}</p>
        {extra && <p className={`cond ${s.cardFigure}`}>{extra}</p>}
        {claim?.status === "coming" ? (
          <p className={`cond ${s.cardFigure}`}>Coming · exhibit {String(claim.exhibit).padStart(2, "0")}</p>
        ) : (
          <>
            {claim?.figure && (
              <p className={`cond ${s.cardFigure}`}>
                {claim.figure.label}: <b>{claim.figure.display}</b>
              </p>
            )}
            <ExhibitVisual v={claim?.visual ?? null} compact />
          </>
        )}
        <p className={`cond ${s.cardLinks}`}>
          <Link href={`/office#${f.claim}`}>The proof</Link>
          {f.links?.map((l) => (l.href.startsWith("#") ? <a key={l.href} href={l.href}>{l.label}</a> : <Link key={l.href} href={l.href}>{l.label}</Link>))}
        </p>
      </div>
    </div>
  );
}
