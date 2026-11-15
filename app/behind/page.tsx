import type { Metadata } from "next";
import { connection } from "next/server";
import { formatCheckDate } from "@/lib/time";
import { getPulse } from "@/server/shop/storefront";
import s from "./page.module.css";

export const metadata: Metadata = { title: "Behind the scenes" };

export default async function Behind() {
  await connection();
  const pulse = await getPulse();
  return (
    <main>
      {/* the same turquoise wall as the storefront, so the back office reads as the same shop */}
      <div className={s.band}>
        <p className="cond">Behind the scenes · {formatCheckDate(pulse.date)}</p>
      </div>
      <section className={s.kitchen} aria-labelledby="kitchen-title">
        <h1 id="kitchen-title" className={`script ${s.title}`}>The rail, so far</h1>
        <p className={s.sub}>
          The day&rsquo;s numbers, pinned up where the checks hang, as of right now. The next check on the rail
          is № {pulse.nextTicket}.
        </p>
      </section>
    </main>
  );
}
