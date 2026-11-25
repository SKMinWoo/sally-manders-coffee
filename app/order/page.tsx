import { connection } from "next/server";
import { formatCheckDate } from "@/lib/time";
import { expectedWait } from "@/server/orders";
import { HOUSE_ID, MENU_GROUPS } from "@/server/menu";
import { getMenu, getPulse } from "@/server/orders";
import { OrderForm } from "./OrderForm";

export const metadata = { title: "Order ahead" };

export default async function OrderPage() {
  await connection();
  const [menu, pulse] = await Promise.all([getMenu(), getPulse()]);
  // the wait for 0..50 items at this minute's load, so the check can say "Ready in" as you add
  const waits = Array.from({ length: 51 }, (_, n) => (n ? expectedWait(n, pulse.load, pulse.pace) : 0));
  return (
    <main>
      <OrderForm menu={menu} groups={MENU_GROUPS} houseId={HOUSE_ID} date={formatCheckDate(pulse.date)} waits={waits} />
    </main>
  );
}
