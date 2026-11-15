import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { GuestCheck } from "@/components/shop/GuestCheck";
import { PUBLIC_ID } from "@/lib/ids";
import { formatCheckDate, formatWait } from "@/lib/time";
import { shopDb } from "@/server/db/client";
import { findOrder } from "@/server/db/repositories/orders";
import s from "../order.module.css";
import { Countdown } from "./Countdown";

export const metadata = { title: "Your order", robots: { index: false } };

/** An order's status: its check on the rail, and a countdown to the counter. */
export default async function OrderStatus({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!PUBLIC_ID.test(id)) notFound();
  const now = new Date();
  const order = await findOrder(await shopDb(), id, now);
  if (!order) notFound();

  const wait = Math.round((order.readyAt.getTime() - order.placedAt.getTime()) / 1000);
  return (
    <main className={s.status}>
      <div className={`steel-rail ${s.rail}`} aria-hidden="true" />
      <GuestCheck
        ticket={order.ticket}
        date={formatCheckDate(order.day)}
        ready={formatWait(wait)}
        lines={order.lines.map((l) => ({ id: l.itemId, qty: l.qty, name: l.name, cents: l.priceCents }))}
      />
      <Countdown readyAt={order.readyAt.getTime()} serverNow={now.getTime()} />
      <Link href="/order" className={s.again}>Order something else</Link>
      <p className={`sim-note ${s.note}`}>A simulated shop: no drink is coming, but the wait is the one a real order would get right now.</p>
    </main>
  );
}
