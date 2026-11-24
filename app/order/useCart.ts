"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CheckLine } from "@/components/shop/GuestCheck";
import type { MenuRow } from "@/server/menu";
import { CART_KEY } from "./cart";

const MAX_LINES = 10;
const MAX_QTY = 5;

type Cart = Record<string, number>;

// sessionStorage is the cart's one source of truth, read through useSyncExternalStore: the server
// and the first client render both see an empty check, then the stored one appears with no mismatch.
// The order page and the home page's drawer share it, so a check started in one is there in the other.
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

/** The check as it stands, and the ways to change it. Nothing here is trusted: the server prices it again. */
export function useCart(menu: MenuRow[]) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const cart = useMemo(() => parseCart(raw), [raw]);

  const step = useCallback((id: string, delta: 1 | -1) => {
    const c = parseCart(snapshot());
    if (!(id in c) && delta > 0 && Object.keys(c).length >= MAX_LINES) return;
    const qty = Math.min(MAX_QTY, (c[id] ?? 0) + delta);
    if (qty <= 0) delete c[id];
    else c[id] = qty;
    writeCart(c);
  }, []);
  const clear = useCallback(() => writeCart({}), []);

  const lines: (CheckLine & { id: string })[] = menu
    .filter((m) => cart[m.id])
    .map((m) => ({ id: m.id, qty: cart[m.id] ?? 0, name: m.name, cents: m.priceCents }));
  const items = lines.reduce((n, l) => n + l.qty, 0);
  const payload = JSON.stringify(lines.map((l) => ({ itemId: l.id, qty: l.qty })));
  return { cart, lines, items, payload, step, clear };
}
