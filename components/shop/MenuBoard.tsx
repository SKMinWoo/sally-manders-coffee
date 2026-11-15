import { formatPrice } from "@/lib/money";
import type { MenuRow } from "@/server/db/repositories/menu";
import { HOUSE_ID, MENU_GROUPS } from "@/server/sim/menu";
import s from "./MenuBoard.module.css";

/** Today's board, painted from the menu table: four sections, dotted leaders, the house drink in script. */
export function MenuBoard({ menu }: { menu: MenuRow[] }) {
  return (
    <section className={s.row} id="board" aria-labelledby="board-title">
      <h2 id="board-title" className={`script ${s.title}`}>Today&rsquo;s board</h2>
      <div className={s.board}>
        {MENU_GROUPS.map((g) => (
          <div key={g.id} className={s[g.id]}>
            <h3 className="block">{g.title}</h3>
            <ul>
              {menu.filter((m) => m.group === g.id).map((m) => (
                <li key={m.id} className={m.id === HOUSE_ID ? s.house : undefined}>
                  <b>{m.name}</b>
                  <i aria-hidden="true" />
                  <span>
                    <span className="visually-hidden">$</span>
                    {formatPrice(m.priceCents)}
                  </span>
                  {m.note && <small>{m.note}</small>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
