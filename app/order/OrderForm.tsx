"use client";

import { useActionState, useMemo, useSyncExternalStore } from "react";
import { GuestCheck } from "@/components/shop/GuestCheck";
import { MenuBoard } from "@/components/shop/MenuBoard";
import { formatWait } from "@/lib/time";
import type { MenuRow } from "@/server/db/repositories/menu";
import { putOnRail, type OrderState } from "./actions";
import { CART_KEY } from "./cart";
import s from "./order.module.css";

const MAX_LINES = 10;
const MAX_QTY = 5;

type Cart = Record<string, number>;

// sessionStorage is the cart's one source of truth, read through useSyncExternalStore: the server
// and the first client render both see an empty check, then the stored one appears with no mismatch.
const CHANGED = "sally:check-changed";
const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGED, cb);
    window.removeEventListener("storage", cb);
  };
};
const snapshot = () => {
  try {
    return sessionStorage.getItem(CART_KEY) ?? "{}";
  } catch {
    return "{}";
  }
};

function parseCart(raw: string): Cart {
  try {
    const c: unknown = JSON.parse(raw);
    return c && typeof c === "object" ? (c as Cart) : {};
  } catch {
    return {};
  }
}

function writeCart(c: Cart) {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(c));
  } catch {}
  window.dispatchEvent(new Event(CHANGED));
}

/**
 * The board and the check, side by side. The cart lives in sessionStorage so a reload keeps it;
 * the server action prices it again from the database, so nothing here is trusted.
 * `waits[n]` is the wait for an n-item order at the shop's current load.
 */
export function OrderForm({ menu, date, waits }: { menu: MenuRow[]; date: string; waits: number[] }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const cart = useMemo(() => parseCart(raw), [raw]);
  const [state, action, pending] = useActionState<OrderState, FormData>(putOnRail, null);

  const step = (id: string, delta: 1 | -1) => {
    const c = parseCart(snapshot());
    if (!(id in c) && delta > 0 && Object.keys(c).length >= MAX_LINES) return;
    const qty = Math.min(MAX_QTY, (c[id] ?? 0) + delta);
    if (qty <= 0) delete c[id];
    else c[id] = qty;
    writeCart(c);
  };

  const lines = menu.filter((m) => cart[m.id]).map((m) => ({ id: m.id, qty: cart[m.id] ?? 0, name: m.name, cents: m.priceCents }));
  const items = lines.reduce((n, l) => n + l.qty, 0);
  const ready = items ? formatWait(waits[Math.min(items, waits.length - 1)] ?? 0) : "—";
  const payload = JSON.stringify(lines.map((l) => ({ itemId: l.id, qty: l.qty })));

  return (
    <div>
      <MenuBoard menu={menu} title="Pick from the board" onAdd={(id) => step(id, 1)} counts={cart} />
      <form action={action} className={s.form}>
        <div className={`steel-rail ${s.rail}`} aria-hidden="true" />
        <GuestCheck ticket="A-··" date={date} ready={ready} lines={lines} onStep={step} empty="Tap the board to add" />
        <input type="hidden" name="lines" value={payload} />
        <button className={s.go} type="submit" disabled={!items || pending}>
          {pending ? "Hanging it up…" : "Put it on the rail"}
        </button>
        {state?.message && <p role="alert" className={s.alert}>{state.message}</p>}
        <p className={`sim-note ${s.note}`}>Pretend checkout: nothing is charged, and nothing is asked about you.</p>
      </form>
    </div>
  );
}
