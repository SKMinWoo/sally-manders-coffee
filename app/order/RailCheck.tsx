"use client";

import { GuestCheck, type CheckLine } from "@/components/shop/GuestCheck";
import s from "./order.module.css";

/**
 * The check under the rail and the button that hangs it up: the order page and the home page's
 * drawer both use it, so the two read as one counter. The form posts one field, the check as JSON.
 */
export function RailCheck({
  action,
  pending,
  message,
  date,
  ready,
  lines,
  payload,
  onStep,
  className,
}: {
  action: (form: FormData) => void;
  pending: boolean;
  message?: string;
  date: string;
  ready: string;
  lines: CheckLine[];
  payload: string;
  onStep: (id: string, delta: 1 | -1) => void;
  className?: string;
}) {
  const items = lines.reduce((n, l) => n + l.qty, 0);
  return (
    <form action={action} className={`${s.form} ${className ?? ""}`}>
      <div className={`steel-rail ${s.rail}`} aria-hidden="true" />
      <GuestCheck ticket="A-··" date={date} ready={ready} lines={lines} onStep={onStep} empty="Tap the board to add" />
      <input type="hidden" name="lines" value={payload} />
      <button className={s.go} type="submit" disabled={!items || pending}>
        {pending ? "Hanging it up…" : "Put it on the rail"}
      </button>
      {message && <p role="alert" className={s.alert}>{message}</p>}
      <p className={`sim-note ${s.note}`}>Pretend checkout: nothing is charged, and nothing is asked about you.</p>
    </form>
  );
}
