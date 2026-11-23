"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { placeHere, type HereState } from "@/app/order/actions";
import { RailCheck } from "@/app/order/RailCheck";
import { useCart } from "@/app/order/useCart";
import { MenuBoard } from "@/components/shop/MenuBoard";
import { formatWait } from "@/lib/time";
import type { MenuGroup, MenuRow } from "@/server/menu";
import type { PlacedHere } from "./Guests";
import s from "./front.module.css";

/** What the drawer needs from the server page: the board, and the wait for 0..50 items at this minute's load. */
export interface OrderMenu {
  menu: MenuRow[];
  groups: { id: MenuGroup; title: string }[];
  houseId: string;
  date: string;
  waits: number[];
}

/**
 * The board and the check, pulled out beside the model so a visitor can order without losing sight of
 * it, and then watch their own guest walk in. Not a dialog: the model stays live and reachable, and
 * the fixture card keeps the page's one role="dialog". The order goes through the same checks as the
 * order page (placeVisitorOrder), but the action answers instead of redirecting.
 */
export function OrderDrawer({
  id,
  open,
  onClose,
  onPlaced,
  order,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  onPlaced: (o: PlacedHere) => void;
  order: OrderMenu;
}) {
  const { menu, groups, houseId, date, waits } = order;
  const { cart, lines, items, payload, step, clear } = useCart(menu);
  const [state, action, pending] = useActionState<HereState, FormData>(placeHere, null);
  const [seen, setSeen] = useState<string | null>(null); // the order whose status the visitor has moved past
  const handled = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const ready = items ? formatWait(waits[Math.min(items, waits.length - 1)] ?? 0) : "—";

  // an order on the rail: its guest sets off on the model, and the check starts over
  useEffect(() => {
    if (!state?.ok || handled.current === state.publicId) return;
    handled.current = state.publicId;
    onPlaced({ placedAt: state.placedAt, readyAt: state.readyAt, items: state.items });
    clear();
  }, [state, onPlaced, clear]);

  // opening moves the reader into the drawer; closing is the page's job (focus back on the button)
  useEffect(() => {
    if (open) heading.current?.focus({ preventScroll: true });
  }, [open]);

  const placed = state?.ok && seen !== state.publicId ? state : null;

  return (
    <aside id={id} className={s.drawer} data-open={open ? "" : undefined} aria-label="Order" inert={!open}>
      <div className={s.drawerHead}>
        <h2 ref={heading} tabIndex={-1} className={`script ${s.drawerTitle}`}>
          Order here
        </h2>
        <button type="button" className={s.drawerClose} onClick={onClose} aria-label="Close the order">
          <span aria-hidden="true">×</span>
        </button>
      </div>
      {placed ? (
        <Placed key={placed.publicId} o={placed} onAgain={() => setSeen(placed.publicId)} />
      ) : (
        <>
          <p className={`cond ${s.drawerLede}`}>Pick from the board, hang the check on the rail, and watch your guest walk in.</p>
          <MenuBoard compact idPrefix="drawer-" menu={menu} groups={groups} houseId={houseId} title="Today’s board" onAdd={(i) => step(i, 1)} counts={cart} />
          <RailCheck
            className={s.drawerCheck}
            action={action}
            pending={pending}
            message={state && !state.ok ? state.message : undefined}
            date={date}
            ready={ready}
            lines={lines}
            payload={payload}
            onStep={step}
          />
        </>
      )}
    </aside>
  );
}

/** The order on the rail: its ticket, a countdown to ready, and the way to its own page. */
function Placed({ o, onAgain }: { o: Extract<HereState, { ok: true }>; onAgain: () => void }) {
  // counted on this browser's clock from now, so a skew between it and the server's can't show a wrong wait
  const [end] = useState(() => Date.now() + (o.readyAt - o.placedAt));
  const [left, setLeft] = useState(o.readyAt - o.placedAt);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, end - Date.now())), 1000);
    return () => clearInterval(id);
  }, [end]);
  const done = left <= 0;
  return (
    <div className={s.placed} role="status">
      <p className={`cond ${s.placedKicker}`}>Order {o.ticket} · on the rail</p>
      <p className={s.placedClock}>{done ? "Ready" : formatWait(left / 1000)}</p>
      <p className={s.placedNote}>
        {done ? "Up at the pass." : "until it’s up."} Your guest is the one with the brass ring, walking in on the model now.
      </p>
      <p className={s.placedWays}>
        <Link href={`/order/${o.publicId}`}>Follow your order &rarr;</Link>
        <button type="button" onClick={onAgain}>Order something else</button>
      </p>
    </div>
  );
}
