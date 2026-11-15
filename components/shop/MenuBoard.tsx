import { formatPrice } from "@/lib/money";
import type { MenuRow } from "@/server/db/repositories/menu";
import { HOUSE_ID, MENU_GROUPS } from "@/server/sim/menu";
import s from "./MenuBoard.module.css";

/**
 * Today's board, painted from the menu table: four sections, dotted leaders, the house drink in
 * script. Given `onAdd` (the order page), every row is a button that puts the item on the check.
 */
export function MenuBoard({
  menu,
  title = "Today’s board",
  onAdd,
  counts = {},
}: {
  menu: MenuRow[];
  title?: string;
  onAdd?: (id: string) => void;
  counts?: Record<string, number>;
}) {
  return (
    <section className={s.row} id="board" aria-labelledby="board-title">
      <h2 id="board-title" className={`script ${s.title}`}>{title}</h2>
      <div className={`${s.board} ${onAdd ? s.orderable : ""}`}>
        {MENU_GROUPS.map((g) => (
          <div key={g.id} className={s[g.id]}>
            <h3 className="block">{g.title}</h3>
            <ul>
              {menu.filter((m) => m.group === g.id).map((m) => {
                const n = counts[m.id] ?? 0;
                const body = (
                  <>
                    <b>{m.name}</b>
                    <i aria-hidden="true">{n > 0 && <span className={s.count}>×{n}</span>}</i>
                    <span className={s.price}>
                      <span className="visually-hidden">$</span>
                      {formatPrice(m.priceCents)}
                    </span>
                    {m.note && <small>{m.note}</small>}
                  </>
                );
                return (
                  <li key={m.id} className={m.id === HOUSE_ID ? s.house : undefined}>
                    {onAdd ? (
                      <button type="button" className={s.item} onClick={() => onAdd(m.id)} aria-label={`Add ${m.name}, $${formatPrice(m.priceCents)}${n ? `, ${n} on your check` : ""}`}>
                        {body}
                      </button>
                    ) : (
                      <div className={s.item}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
