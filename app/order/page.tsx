import { connection } from "next/server";
import { formatCheckDate } from "@/lib/time";
import { expectedWait } from "@/server/shop/wait";
import { getMenu, getPulse } from "@/server/shop/storefront";
import { OrderForm } from "./OrderForm";

export const metadata = { title: "Order ahead" };

export default async function OrderPage() {
  await connection();
  const [menu, pulse] = await Promise.all([getMenu(), getPulse()]);
  // the wait for 0..50 items at this minute's load, so the check can say "Ready in" as you add
  const waits = Array.from({ length: 51 }, (_, n) => (n ? expectedWait(n, pulse.load) : 0));
  return (
    <main>
      <OrderForm menu={menu} date={formatCheckDate(pulse.date)} waits={waits} />
    </main>
  );
}
