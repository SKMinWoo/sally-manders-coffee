import { formatPrice, taxCents } from "@/lib/money";
import { formatCheckDate, formatWait } from "@/lib/time";
import type { MenuRow } from "@/server/db/repositories/menu";
import type { Pulse } from "@/server/shop/storefront";
import s from "./GuestCheck.module.css";

export interface CheckLine {
  /** the menu id; needed only when the check can be edited */
  id?: string;
  qty: number;
  name: string;
  cents: number;
}

/**
 * A diner guest check: green rules, the server's ballpoint, the total in red. The same paper is
 * used for the checks on the rail behind the scenes, so the two views read as one shop.
 * Given `onStep` (the order page), each line gets a − and + in the margin.
 */
export function GuestCheck({
  ticket,
  date,
  ready,
  lines,
  onStep,
  empty,
}: {
  ticket: string;
  date: string;
  ready: string;
  lines: CheckLine[];
  onStep?: (id: string, delta: 1 | -1) => void;
  empty?: string;
}) {
  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.cents, 0);
  const tax = taxCents(subtotal);
  return (
    <div className={s.check}>
      <div className={s.top}>
        <b>Guest check</b>
        <span className={s.no}>№ {ticket}</span>
      </div>
      <div className={s.meta}>
        <span>Date<em>{date}</em></span>
        <span>Server<em>Sally</em></span>
        <span>Ready<em>{ready}</em></span>
      </div>
      <dl aria-live={onStep ? "polite" : undefined}>
        {lines.length === 0 && empty && (
          <div className={`${s.line} ${s.empty}`}>
            <dt>{empty}</dt>
            <dd />
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id ?? l.name} className={`${s.line} ${onStep ? s.editable : ""}`}>
            <dt>
              {onStep && l.id && (
                <span className={s.steps}>
                  <button type="button" onClick={() => onStep(l.id!, -1)} aria-label={`One less ${l.name}`}>−</button>
                  <button type="button" onClick={() => onStep(l.id!, 1)} aria-label={`One more ${l.name}`}>+</button>
                </span>
              )}
              {l.qty} {l.name}
            </dt>
            <dd>{formatPrice(l.qty * l.cents)}</dd>
          </div>
        ))}
        <div className={s.line}>
          <dt>Tax</dt>
          <dd>{formatPrice(tax).replace(/^0/, "")}</dd>
        </div>
        <div className={`${s.line} ${s.total}`}>
          <dt>Total</dt>
          <dd>{formatPrice(subtotal + tax)}</dd>
        </div>
      </dl>
      <p className={s.thanks}>Thank you · come again</p>
    </div>
  );
}

/** The storefront's example: the house drink and a kolache, on the next ticket, at today's wait. */
export function ExampleCheck({ menu, pulse }: { menu: MenuRow[]; pulse: Pulse }) {
  const pick = (id: string) => menu.find((m) => m.id === id);
  const lines = [pick("sixty-eight"), pick("kolache")]
    .filter((m): m is MenuRow => m !== undefined)
    .map((m) => ({ qty: 1, name: m.id === "kolache" ? "Kolache" : m.name, cents: m.priceCents }));
  return <GuestCheck ticket={pulse.nextTicket} date={formatCheckDate(pulse.date)} ready={formatWait(pulse.waitForTwo)} lines={lines} />;
}
