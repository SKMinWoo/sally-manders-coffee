"use client";

import { useCallback, useState, type ReactNode } from "react";
import type { Order } from "@/lib/footfall";
import beauty from "@/public/cutaway/hero-beauty.webp";
import dark from "@/public/cutaway/hero-dark.webp";
import roof from "@/public/cutaway/hero-shell.webp";
import closed from "@/public/cutaway/hero-closed.webp";
import cutaway from "./cutaway.json";
import { PLATES, type FixtureKey } from "./fixtures";
import { Floors } from "./Floors";
import { GuestCaption, RailCount, useFootfall } from "./Guests";
import { Model, type FixtureClaim, type Meta, type View } from "./Model";
import s from "./front.module.css";

const meta = cutaway as unknown as Meta;

/**
 * The home page's model and its three plates: the cutaway with the guests walking in, the switch
 * between what guests see and what runs it, and the plates that light each floor as they pass.
 * The model takes the first screen's wide column; the page's intro heads the plates beside it.
 */
export function Room({
  lift,
  initial,
  asOf,
  frozen,
  base,
  claims,
  menuCount,
  intro,
}: {
  lift: boolean;
  initial: Order[];
  asOf: number;
  frozen: boolean;
  base: string;
  claims: Partial<Record<FixtureKey, FixtureClaim>>;
  menuCount: number;
  /** the page's kicker, headline and lede, at the head of the plates' column */
  intro: ReactNode;
}) {
  const [view, setView] = useState<View>("guests");
  const [picked, setPicked] = useState<FixtureKey | null>(null);
  const [plate, setPlate] = useState<number | null>(null);
  const footfall = useFootfall(initial, asOf, frozen, base);

  const pickFromPlate = useCallback((k: FixtureKey) => {
    setView("behind");
    setPicked(k);
  }, []);
  const flip = () => {
    setView((v) => (v === "guests" ? "behind" : "guests"));
    setPicked(null);
  };

  const extra: Partial<Record<FixtureKey, React.ReactNode>> = {
    rail: frozen ? null : <RailCount state={footfall} />,
    boards: `${menuCount} items today`,
  };
  const active = plate === null ? null : PLATES[plate]!;

  return (
    <section className={s.room} aria-label="The model">
      <div className={s.modelCol}>
        <div className={s.toolbar}>
          <span className={`cond ${s.switch}`}>
            <span aria-hidden="true">Guests&rsquo; view</span>
            <button type="button" aria-pressed={view === "behind"} aria-label="What runs it" onClick={flip} />
            <span aria-hidden="true">What runs it</span>
          </span>
        </div>
        {/* the Study's cut-out lands here (the portfolio's ZoomLink names it the same): this frame is
            exactly the render, whose crop is the Study's set box, and it arrives showing the very file
            the Study flies in (hero-closed.webp), so the morph is one picture moving and scaling.
            Inline, because a CSS module would scope the name and the two pages would no longer match. */}
        <div id="sally-model" className={s.set} style={{ viewTransitionName: "sally" }}>
          <Model
            meta={meta}
            beauty={beauty}
            dark={dark}
            roof={roof}
            closed={closed}
            lift={lift}
            view={view}
            picked={picked}
            onPick={setPicked}
            zones={active?.zones ?? null}
            plateKeys={active?.keys ?? null}
            footfall={footfall}
            claims={claims}
            extra={extra}
          />
        </div>
        <GuestCaption state={footfall} frozen={frozen} />
      </div>
      <div className={s.side}>
        {intro}
        <Floors onActive={setPlate} onPick={pickFromPlate} claims={claims} extra={extra} meta={meta} beautySrc={beauty.src} />
      </div>
    </section>
  );
}
