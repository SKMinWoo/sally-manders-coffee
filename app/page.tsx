import Link from "next/link";
import { connection } from "next/server";
import o from "./order/order.module.css";
import { ExampleCheck } from "@/components/shop/GuestCheck";
import { MenuBoard } from "@/components/shop/MenuBoard";
import { WallSign } from "@/components/shop/WallSign";
import { HOUSE_ID, MENU_GROUPS } from "@/server/menu";
import { getMenu, getPulse } from "@/server/orders";
import s from "./page.module.css";

export default async function Storefront() {
  await connection(); // rendered per request (from a one-minute cache), never at build, which has no database
  const [menu, pulse] = await Promise.all([getMenu(), getPulse()]);
  return (
    <main>
      <WallSign />
      <MenuBoard menu={menu} groups={MENU_GROUPS} houseId={HOUSE_ID} />
      <section className={s.checkrow} aria-labelledby="rail-title">
        <div>
          <p className="cond" style={{ color: "var(--teal)" }}>Your order</p>
          <h2 id="rail-title" className={`script ${s.title}`}>On the rail</h2>
          <p className={s.copy}>
            Your check goes up on the rail behind the counter the moment you order, and comes down when your
            drink does. The rail is how the shop keeps time. The Barton Springs salamander lives in the springs
            of one Austin creek and nowhere else.
          </p>
          <Link href="/order" className={o.go} style={{ display: "inline-block", marginTop: 22 }}>Order ahead</Link>
        </div>
        <ExampleCheck menu={menu} pulse={pulse} />
      </section>
    </main>
  );
}
