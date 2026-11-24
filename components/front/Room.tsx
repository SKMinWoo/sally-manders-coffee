"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Order } from "@/lib/footfall";
import beauty from "@/public/cutaway/hero-beauty.webp";
import dark from "@/public/cutaway/hero-dark.webp";
import roof from "@/public/cutaway/hero-shell.webp";
import closed from "@/public/cutaway/hero-closed.webp";
import { Acts, ACTS } from "./Acts";
import cutaway from "./cutaway.json";
import { FIXTURES, type FixtureKey } from "./fixtures";
import { Charts } from "./Charts";
import { GuestCaption, RailCount, useFootfall, type PlacedHere } from "./Guests";
import { Card, Model, type FixtureClaim, type Meta } from "./Model";
import { OrderDrawer, OrderRest, type OrderMenu } from "./OrderDrawer";
import type { NumbersData } from "./useLive";
import s from "./front.module.css";

const meta = cutaway as unknown as Meta;

/** Where the model pins and the acts change over it as the page scrolls (front.module.css's wide layout). */
const WIDE = "(min-width: 1001px)";

/**
 * The home page's first part: the model, and the shop told in three acts beside it (the shop, the
 * numbers it keeps, how it's built). On a wide screen the model pins while three markers scroll
 * past behind it, and whichever marker crosses the middle of the screen is the act on show; it lets
 * go where Today's board begins. Narrower, the model sticks to the top and the acts scroll under it
 * as ordinary sections. Either way the act switches and scrollY is never read; the one thing that
 * follows the scroll is the reading lamp dimming into "How it's built", and that is a CSS view
 * timeline on the compositor (front.module.css's lamp-on/lamp-off), not script.
 */
export function Room({
  lift,
  initial,
  asOf,
  frozen,
  base,
  claims,
  menuCount,
  shop,
  numbers,
  figures,
  order,
}: {
  lift: boolean;
  initial: Order[];
  asOf: number;
  frozen: boolean;
  base: string;
  claims: Partial<Record<FixtureKey, FixtureClaim>>;
  menuCount: number;
  /** act 1: the kicker, headline, lede and the way to order */
  shop: ReactNode;
  /** act 2: today's three lead figures, against last week */
  numbers: ReactNode;
  /** act 2's live charts: today's figures as the server had them */
  figures: NumbersData;
  /** the board and the waits, for the order drawer beside the model */
  order: OrderMenu;
}) {
  const [act, setAct] = useState(0);
  const [wide, setWide] = useState(false);
  const [picked, setPicked] = useState<FixtureKey | null>(null);
  const [hot, setHot] = useState<FixtureKey | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [fresh, setFresh] = useState(0); // set when this visitor orders: the charts ask again at once
  const footfall = useFootfall(initial, asOf, frozen, base);
  const story = useRef<HTMLElement>(null);
  const orderButton = useRef<HTMLButtonElement>(null);

  // two things open the drawer (the token, and wide, the card at rest), so closing it hands focus back
  // to whichever did. After the commit, not in the handler: the card is still hidden until it re-renders
  const opener = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  const openOrder = useCallback((el: HTMLElement) => {
    opener.current = el;
    setOrdering(true);
  }, []);
  const closeOrder = useCallback(() => setOrdering(false), []);
  useEffect(() => {
    if (ordering) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    (opener.current ?? orderButton.current)?.focus({ preventScroll: true });
  }, [ordering]);
  // wide, whether the drawer's column is clear of the model, so its closed face can rest there (a tall
  // window gives the model the column's whole width, and then the card would sit on it)
  const [room, setRoom] = useState(false);
  const { add } = footfall;
  const placed = useCallback(
    (o: PlacedHere) => {
      add(o);
      setFresh(Date.now());
    },
    [add],
  );

  // Narrower, the token floats at the bottom of the screen, so while the first act's own "Order ahead"
  // (page.tsx marks it data-order-cta) is in view it stands back rather than sit on the manager's slip.
  const [shy, setShy] = useState(false);
  useEffect(() => {
    const cta = story.current?.querySelector("[data-order-cta]");
    if (wide || !cta) {
      setShy(false);
      return;
    }
    // the model sticks to the top here, so a link scrolled under it is gone to the eye though still in
    // the viewport: the line the link must cross is the stuck model's foot, measured once
    const top = document.getElementById("sally-model")?.parentElement?.offsetHeight ?? 0;
    const io = new IntersectionObserver(([e]) => setShy(e!.isIntersecting), { rootMargin: `-${top}px 0px 0px 0px` });
    io.observe(cta);
    return () => io.disconnect();
  }, [wide]);

  useEffect(() => {
    if (!ordering) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeOrder();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [ordering, closeOrder]);

  // Wide, the drawer comes out over the right of the pin. Where the model reaches under it (a tall
  // window gives the model the column's whole width), the model steps aside: it scales down from its
  // left edge until it ends clear of the drawer. Measured once a change (open, close, resize), never
  // per frame, and carried out by a CSS scale transition on the compositor.
  const modelCol = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const col = modelCol.current;
    if (!col) return;
    const fit = () => {
      const stage = col.querySelector<HTMLElement>('[style*="view-transition-name"]');
      const drawer = document.getElementById("order-drawer");
      if (!ordering || !wide || !stage || !drawer) return (col.style.scale = "");
      // the drawer docks against the pin's right padding (a grid item now, not offset by `right`)
      const pinEl = col.parentElement!;
      const pin = pinEl.getBoundingClientRect();
      const left = pin.right - parseFloat(getComputedStyle(pinEl).paddingRight) - drawer.offsetWidth;
      const c = col.getBoundingClientRect(), st = stage.getBoundingClientRect();
      const scale = col.style.scale ? Number(col.style.scale) : 1;
      // the render's right twentieth is the lamp's pool, so the model itself ends 95% across
      const reach = (st.left - c.left) / scale + (st.width / scale) * 0.95;
      col.style.scale = String(Math.min(1, (left - 20 - c.left) / reach));
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [ordering, wide]);

  // Wide, the Order button sits on the model's lower right corner. The model's size comes from the
  // space the band leaves, which CSS can't hand to a sibling, so the stage is measured whenever the
  // column resizes (never per frame) and the corner written to the pin as two custom properties.
  useEffect(() => {
    const col = modelCol.current;
    const pinEl = col?.parentElement;
    if (!col || !pinEl) return;
    const clear = () => {
      pinEl.style.removeProperty("--order-x");
      pinEl.style.removeProperty("--order-y");
    };
    if (!wide) {
      clear();
      return;
    }
    const place = () => {
      if (col.style.scale) return; // stepped aside for the open drawer, and the button is hidden anyway
      const stage = col.querySelector<HTMLElement>('[style*="view-transition-name"]');
      if (!stage) return;
      const p = pinEl.getBoundingClientRect(), st = stage.getBoundingClientRect();
      // the render's lower right corner is open floor beside the street lamp
      pinEl.style.setProperty("--order-x", `${Math.round(st.right - p.left - 92 - 6)}px`);
      pinEl.style.setProperty("--order-y", `${Math.round(st.bottom - p.top - 92 - 14)}px`);
      // the drawer's left edge, as stepAside measures it, against where the model itself ends; and the
      // card must fit the model's row, or centred in a short one it would ride up over the band's copy
      const drawer = document.getElementById("order-drawer");
      const rest = pinEl.querySelector<HTMLElement>("[data-rest]");
      if (drawer && rest) {
        const left = p.right - parseFloat(getComputedStyle(pinEl).paddingRight) - drawer.offsetWidth;
        setRoom(st.left + st.width * 0.95 < left - 20 && rest.offsetHeight <= col.offsetHeight - 20);
      }
    };
    const ro = new ResizeObserver(place);
    ro.observe(col);
    return () => {
      ro.disconnect();
      clear();
    };
  }, [wide]);

  useEffect(() => {
    const mq = matchMedia(WIDE);
    const set = () => setWide(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  // Wide, the markers behind the pin say which act is on; narrower, the act sections themselves do.
  // The line is the middle of the screen wide, and just under the stuck model narrower.
  useEffect(() => {
    const el = story.current;
    if (!el) return;
    const marks = [...el.querySelectorAll<HTMLElement>(wide ? "[data-step]" : "[data-act]")];
    const inView = new Set<number>();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          const i = Number((e.target as HTMLElement).dataset[wide ? "step" : "act"]);
          if (e.isIntersecting) inView.add(i);
          else inView.delete(i);
        }
        if (!inView.size) return;
        const next = Math.max(...inView);
        setAct(next);
        // leaving "How it's built" puts the beads away, and the card with them
        if (next !== 2) {
          setPicked(null);
          setHot(null);
        }
      },
      { rootMargin: wide ? "-50% 0px -50% 0px" : "-62% 0px -36% 0px" },
    );
    for (const m of marks) io.observe(m);
    return () => io.disconnect();
  }, [wide]);

  useEffect(() => {
    if (!picked) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setPicked(null);
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [picked]);

  /** A tab brings its act's marker to the middle of the screen (wide; the line the observer watches)
   *  or its section to the top (narrower); the observer then makes it the act. */
  const go = useCallback(
    (i: number) => {
      const el = story.current?.querySelector<HTMLElement>(wide ? `[data-step="${i}"]` : `[data-act="${i}"]`);
      if (!el) return;
      const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: wide ? "center" : "start", behavior: still ? "auto" : "smooth" });
    },
    [wide],
  );

  const extra: Partial<Record<FixtureKey, React.ReactNode>> = {
    rail: frozen ? null : <RailCount state={footfall} />,
    boards: `${menuCount} items today`,
  };
  const fixture = picked ? FIXTURES.find((f) => f.key === picked)! : null;
  const card = fixture && (
    <Card
      key={fixture.key}
      f={fixture}
      x={meta.anchors[fixture.key]![0] / meta.size[0]}
      claim={claims[fixture.key]}
      extra={extra[fixture.key]}
      onClose={() => setPicked(null)}
    />
  );

  // one set of charts, kept mounted so its figures survive leaving the act: wide, under the model in
  // the caption's place while "The numbers" is on; narrower, inside that act's own section
  const charts = <Charts initial={figures} footfall={footfall} base={base} active={act === 1} frozen={frozen} fresh={fresh} />;

  return (
    <section ref={story} className={s.story} aria-label="The model">
      <div className={s.pin}>
        <Acts
          act={act}
          wide={wide}
          go={go}
          shop={shop}
          numbers={
            <>
              {numbers}
              {/* the server can't know the width, so it renders this slot; on a wide screen CSS keeps it
                  out of the band from the first paint, or the band would be a chart taller until
                  hydration and the model would grow under the arriving visitor's eyes */}
              {!wide && <div className={s.narrowCharts}>{charts}</div>}
            </>
          }
          claims={claims}
          picked={picked}
          onPick={setPicked}
          hot={hot}
          onHot={setHot}
          card={card}
        />
        <div ref={modelCol} className={s.modelCol}>
          {/* the Study's cut-out lands on the model's stage inside (Model.tsx names it "sally"), not on
              this column, which on a phone is narrower than the picture */}
          <div id="sally-model" className={s.set}>
            <Model
              meta={meta}
              beauty={beauty}
              dark={dark}
              roof={roof}
              closed={closed}
              lift={lift}
              view={act === 2 ? "built" : "guests"}
              picked={picked}
              onPick={setPicked}
              hot={hot}
              onHot={setHot}
              coming={FIXTURES.filter((f) => claims[f.key]?.status === "coming").map((f) => f.key)}
              footfall={footfall}
            />
          </div>
          <div className={s.below} data-charts={wide && act === 1 ? "" : undefined}>
            <GuestCaption state={footfall} frozen={frozen} />
            {wide && charts}
          </div>
        </div>
        {/* the way to order without leaving the model: a round button at the model's lower right that
            pulls the board out beside it (wide) or up from the bottom (narrower). Not "Order ahead",
            which stays the name of the links to the order page */}
        <button
          ref={orderButton}
          type="button"
          className={s.orderButton}
          data-shy={shy && !ordering ? "" : undefined}
          aria-expanded={ordering}
          aria-controls="order-drawer"
          onClick={(e) => (ordering ? closeOrder() : openOrder(e.currentTarget))}
        >
          <span className={s.orderButtonRing} aria-hidden="true" />
          Order
        </button>
        {/* wide, the drawer's closed face rests where it comes out, through the shop and its numbers;
            "How it's built" dims the lamp and points at the model, so the card stands back for it */}
        <OrderRest order={order} on={wide && room && act < 2 && !ordering} onOpen={openOrder} />
        <OrderDrawer id="order-drawer" open={ordering} onClose={closeOrder} onPlaced={placed} order={order} />
      </div>
      {/* wide only: what the page scrolls past while the model is pinned, one marker an act */}
      <div className={s.steps} aria-hidden="true">
        {ACTS.map((a, i) => (
          <div key={a.title} data-step={i} />
        ))}
      </div>
    </section>
  );
}
