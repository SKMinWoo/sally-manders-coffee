"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import type { Walk } from "@/lib/footfall";
import { CLOSEUPS } from "./closeups";
import { FIXTURES, FRONT, type Fixture, type FixtureKey } from "./fixtures";
import { GuestsLayer, useReducedMotion, type FootfallState } from "./Guests";
import type { PegMeta } from "./pegs";
import { ROOF_COOKIE } from "./roof";
import { lensTransform, place, plateRect, type Rect } from "./zoom";
import s from "./front.module.css";

/** The camera's glide onto a spot (front.module.css's .film), and the tags' fade before they move. */
const GLIDE_MS = 900;
const TAGS_OUT_MS = 160;

/**
 * Glides the model's camera to `target` (null: the whole model). The film moves at once; the tags
 * fade out first and take their new places only once they're hidden, then come back when it lands,
 * so no label ever slides or scales with the picture. `moving` is true from the start to the landing.
 */
function useGlide(target: Rect | null) {
  const key = target ? target.join(",") : "";
  const reduced = useReducedMotion();
  const [tags, setTags] = useState({ key, rect: target });
  // the target the camera last landed on: while it differs from the current one, the glide is on
  const [landed, setLanded] = useState(key);
  useEffect(() => {
    if (reduced) return;
    const a = setTimeout(() => setTags((t) => (t.key === key ? t : { key, rect: target })), TAGS_OUT_MS);
    const b = setTimeout(() => setLanded(key), GLIDE_MS);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
    // the key stands for the target, so a new array with the same corners doesn't restart the glide
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reduced]);
  if (reduced) return { tagRect: target, moving: false };
  return { tagRect: tags.rect, moving: landed !== key };
}

export interface Meta {
  size: [number, number];
  /** each fixture's close-up rectangle (cutaway.py's close_rect), which a pick glides to */
  close: Record<string, Rect>;
  anchors: Record<string, [number, number]>;
  walk: Walk;
  seats: [number, number, number, number][];
  zones: Record<string, [number, number][]>;
  /** the guests' peg sprites: their size, and where the feet and the 1.6 m mark fall in them */
  peg: PegMeta;
}

/** A fixture's figure as the plate and the card print it: from its back-office card, or none yet. */
export interface FixtureFigure {
  label: string;
  display: string;
}
export interface FixtureClaim {
  status: "running" | "coming";
  exhibit: number;
  figure: FixtureFigure | null;
}

export type View = "guests" | "behind";

const pct = (v: number, of: number) => `${((100 * v) / of).toFixed(3)}%`;
const path = (pts: [number, number][]) => `M${pts.map((p) => p.join(",")).join("L")}Z`;

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
  zones,
  plateKeys,
  footfall,
  claims,
  extra,
}: {
  meta: Meta;
  beauty: StaticImageData;
  /** the same set with the reading lamp off, only its own bulbs lit: "What runs it" */
  dark: StaticImageData;
  roof: StaticImageData;
  /** the whole set, roof on, cropped from the Study's cut-out (portfolio scene.py --closed) */
  closed: StaticImageData;
  /** arrive roofed and lift it off (decided on the server: see roof.ts) */
  lift: boolean;
  view: View;
  picked: FixtureKey | null;
  onPick: (k: FixtureKey | null) => void;
  /** the zones the plate in view lights, or null for none */
  zones: readonly string[] | null;
  /** the fixtures on the plate in view, which keep full strength while the rest dim */
  plateKeys: readonly FixtureKey[] | null;
  footfall: FootfallState;
  claims: Partial<Record<FixtureKey, FixtureClaim>>;
  /** a live figure a fixture shows that isn't on its back-office card (the rail, the boards) */
  extra: Partial<Record<FixtureKey, React.ReactNode>>;
}) {
  const [W, H] = meta.size;
  const [roofState, setRoof] = useState<"on" | "lifting" | "off">(lift ? "on" : "off");

  useEffect(() => {
    if (!lift) return;
    // Arriving by the Study's zoom, the roof waits for the cut-out to finish landing on the model
    // (page.tsx's ARRIVE script catches the page's view transition before React is here), then a
    // short beat; otherwise a beat to see the shop with its roof on, then up it comes.
    let id: ReturnType<typeof setTimeout> | undefined;
    let gone = false;
    const up = (after: number) => {
      if (!gone) id = setTimeout(() => setRoof("lifting"), after);
    };
    const landing = (window as { __sallyLanding?: Promise<unknown> }).__sallyLanding;
    if (landing) landing.then(() => up(150));
    else up(700);
    return () => {
      gone = true;
      clearTimeout(id);
    };
  }, [lift]);

  const lifted = () => {
    setRoof("off");
    document.cookie = `${ROOF_COOKIE}=1; path=/; SameSite=Lax`; // a session cookie: the rest of this visit arrives open
  };

  useEffect(() => {
    if (!picked) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onPick(null);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [picked, onPick]);

  const shown = FIXTURES.filter((f) => view === "behind" || FRONT.includes(f.key));
  const fixture = picked ? FIXTURES.find((f) => f.key === picked)! : null;
  // the rooms the plate in view isn't about go dark, so the ones it is about stand out
  const unlit = zones ? Object.entries(meta.zones).filter(([k]) => !zones.includes(k)) : [];

  // What's being looked at, the camera glides to: a picked fixture fills the frame, a plate frames
  // its rooms. Not before the roof is off, so the lift still leaves the frame as it always did.
  const target: Rect | null =
    roofState !== "off" ? null : picked ? meta.close[picked] ?? null : zones ? plateRect(zones, meta.zones, meta.size) : null;
  const { tagRect, moving } = useGlide(target);
  // and once it lands on a fixture, the lens refocuses: a close-up rendered on that spot fades in
  const close = picked && target ? CLOSEUPS[view === "behind" ? "dark" : "beauty"][picked] : undefined;
  const [loaded, setLoaded] = useState<string | null>(null);
  const r = picked ? meta.close[picked] : null;

  return (
    <div className={view === "behind" ? s.behind : undefined}>
      <div className={`${s.stage} ${view === "behind" ? s.pins : ""}`} data-roof={roofState} data-moving={moving ? "" : undefined}>
        <div className={s.lens} data-zoom={target ? "" : undefined}>
          <div className={s.film} style={{ transform: lensTransform(target, meta.size) }}>
            <Image className={s.beauty} src={beauty} alt="A painted-wood model of Sally Mander's with the roof lifted off, standing on the page under a reading lamp: the café with its teal counter and menu boards on the right, a dining room with tables and pantry shelving in the middle, the back office on the left, and a toy van at the kerb." sizes="(max-width: 1000px) 100vw, 66vw" priority />
            {/* the lamp goes off for "What runs it": the set lit only by its own bulbs and the street lamp */}
            <Image className={s.dark} src={dark} alt="" sizes="(max-width: 1000px) 100vw, 66vw" />
            {close && r && (
              <Image
                key={close.src}
                className={s.closeup}
                src={close}
                alt=""
                sizes="(max-width: 1000px) 100vw, 66vw"
                style={{ left: pct(r[0], W), top: pct(r[1], H), width: pct(r[2] - r[0], W), height: pct(r[3] - r[1], H) }}
                data-on={!moving && loaded === close.src ? "" : undefined}
                onLoad={() => setLoaded(close.src)}
              />
            )}
            <svg className={s.zones} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-on={zones ? "" : undefined}>
              <path className={s.shade} d={unlit.map(([, p]) => path(p)).join("")} />
              {Object.entries(meta.zones).map(([k, p]) => (
                <path key={k} className={`${s.edge} ${zones?.includes(k) ? s.on : ""}`} d={path(p)} />
              ))}
            </svg>
            <GuestsLayer walk={meta.walk} state={footfall} width={W} height={H} peg={meta.peg} light={view === "behind" ? "dark" : "night"} />
          </div>
        </div>
        {roofState !== "off" && (
          <Image
            className={`${s.roof} ${roofState === "lifting" ? s.lifting : ""}`}
            src={roof}
            alt=""
            sizes="(max-width: 1000px) 100vw, 66vw"
            priority
            onAnimationEnd={lifted}
          />
        )}
        {/* the set as it stands, roof on and casting the roof's own shadow: the very file the Study's
            zoom flies in, so the page change swaps a picture for the same picture. It lets go as the
            roof starts up, taking the roof's shadow with it */}
        {roofState !== "off" && (
          <Image
            className={`${s.closed} ${roofState === "lifting" ? s.opening : ""}`}
            src={closed}
            alt=""
            sizes="(max-width: 1000px) 100vw, 66vw"
            priority
          />
        )}
        {shown.map((f) => {
          const n = FIXTURES.indexOf(f) + 1;
          const [x, y] = place(meta.anchors[f.key]!, tagRect, meta.size);
          const dim = plateKeys && !plateKeys.includes(f.key);
          // a tag whose spot the camera has left behind steps off until it comes back into frame
          const off = x < 0.02 || x > 0.98 || y < 0.02 || y > 0.98;
          return (
            <button
              key={f.key}
              type="button"
              className={`${s.tag} ${dim ? s.dim : ""}`}
              data-key={f.key}
              data-n={n}
              data-edge={x > 0.7 ? "end" : undefined}
              data-off={off ? "" : undefined}
              tabIndex={off ? -1 : undefined}
              style={{ left: pct(x, 1), top: pct(y, 1) }}
              aria-pressed={picked === f.key}
              aria-label={`${n}. ${f.title}, ${f.tech}`}
              onClick={() => onPick(picked === f.key ? null : f.key)}
            >
              <b>{f.title}</b>
              <i>{f.tech}</i>
            </button>
          );
        })}
        {/* the card waits for the camera to land beside its fixture */}
        {fixture && !moving && (
          <Card f={fixture} at={place(meta.anchors[fixture.key]!, tagRect, meta.size)} claim={claims[fixture.key]} extra={extra[fixture.key]} onClose={() => onPick(null)} />
        )}
      </div>
    </div>
  );
}

function Card({
  f,
  at,
  claim,
  extra,
  onClose,
}: {
  f: Fixture;
  /** where its fixture sits in the frame, 0..1, as the camera has it now */
  at: [number, number];
  claim: FixtureClaim | undefined;
  extra: React.ReactNode;
  onClose: () => void;
}) {
  const below = at[1] < 0.5;
  const style = { "--x": pct(at[0], 1), "--y": pct(at[1], 1) } as CSSProperties;
  return (
    <div className={`${s.card} ${below ? s.below : s.above}`} style={style} role="dialog" aria-labelledby="fixture-title">
      <button type="button" className={s.close} onClick={onClose} aria-label="Close">×</button>
      <p className={`cond ${s.cardTech}`}>{f.tech}</p>
      <h3 id="fixture-title">{f.title}</h3>
      <p>{f.blurb}</p>
      {extra && <p className={`cond ${s.cardFigure}`}>{extra}</p>}
      {claim?.status === "coming" ? (
        <p className={`cond ${s.cardFigure}`}>Coming · exhibit {String(claim.exhibit).padStart(2, "0")}</p>
      ) : (
        claim?.figure && (
          <p className={`cond ${s.cardFigure}`}>
            {claim.figure.label}: <b>{claim.figure.display}</b>
          </p>
        )
      )}
      <p className={`cond ${s.cardLinks}`}>
        <Link href={`/office#${f.claim}`}>The proof</Link>
        {f.links?.map((l) => (l.href.startsWith("#") ? <a key={l.href} href={l.href}>{l.label}</a> : <Link key={l.href} href={l.href}>{l.label}</Link>))}
      </p>
    </div>
  );
}
