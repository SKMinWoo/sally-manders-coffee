"use client";

import { useActionState } from "react";
import { MenuBoard } from "@/components/shop/MenuBoard";
import { formatWait } from "@/lib/time";
import type { MenuGroup, MenuRow } from "@/server/menu";
import { putOnRail, type OrderState } from "./actions";
import { RailCheck } from "./RailCheck";
import { useCart } from "./useCart";
import s from "./order.module.css";

/**
 * The board and the check, side by side. The cart lives in sessionStorage so a reload keeps it;
 * the server action prices it again from the database, so nothing here is trusted.
 * `waits[n]` is the wait for an n-item order at the shop's current load.
 */
export function OrderForm({
  menu,
  groups,
  houseId,
  date,
  waits,
}: {
  menu: MenuRow[];
  groups: { id: MenuGroup; title: string }[];
  houseId: string;
  date: string;
  waits: number[];
}) {
  const { cart, lines, items, payload, step } = useCart(menu);
  const [state, action, pending] = useActionState<OrderState, FormData>(putOnRail, null);
  const ready = items ? formatWait(waits[Math.min(items, waits.length - 1)] ?? 0) : "—";

  return (
    <div className={s.split}>
      <MenuBoard menu={menu} groups={groups} houseId={houseId} title="Pick from the board" onAdd={(id) => step(id, 1)} counts={cart} />
      <RailCheck action={action} pending={pending} message={state?.message} date={date} ready={ready} lines={lines} payload={payload} onStep={step} />
    </div>
  );
}
