import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { addDays, formatCheckDate, weekdayOf } from "@/lib/time";
import { getBehind } from "@/server/reporting";
import { ExportSales } from "./ExportSales";
import { HourChart } from "./HourChart";
import { LEAD_METRICS, METRICS, type MetricKey } from "./metrics";
import s from "./page.module.css";

export const metadata: Metadata = { title: "Behind the scenes" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYPART_LABEL = { morning: "Morning, 6–10", midday: "Midday, 10–2", afternoon: "Afternoon, 2–6", late: "Late, 6 pm–6 am" };

const clock = (hour: number, minute: number) =>
  `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;

/** "+12% on last Saturday", or a word when there's no fair comparison. */
function versus(key: MetricKey, today: number | null, last: number | null, weekday: string) {
  if (today === null || last === null || last === 0) return `No figures for last ${weekday} yet`;
  const m = METRICS[key];
  const pct = Math.round(((today - last) / last) * 100);
  if (pct === 0) return `Level with last ${weekday} (${m.format(last)})`;
  // the arrow says better or worse; the word says which way the number moved
  const better = m.lowerIsBetter ? pct < 0 : pct > 0;
  const moved = m.lowerIsBetter ? (pct > 0 ? "slower than" : "faster than") : pct > 0 ? "up on" : "down on";
  return `${better ? "▲" : "▼"} ${Math.abs(pct)}% ${moved} last ${weekday} (${m.format(last)})`;
}

export default async function Behind() {
  await connection();
  const b = await getBehind();
  const weekday = WEEKDAYS[weekdayOf(b.date)]!;
  const rest = (Object.keys(METRICS) as MetricKey[]).filter((k) => !LEAD_METRICS.includes(k));
  const dayMax = Math.max(1, ...b.dayparts.map((d) => d.orders));
  const topMax = Math.max(1, ...b.top.map((t) => t.qty));
  const sim = b.today.orders - b.today.visitorOrders;

  return (
    <main>
      {/* the same turquoise wall as the storefront, so the back office reads as the same shop */}
      <div className="wall-band">
        <p className="cond">Behind the scenes · {formatCheckDate(b.date)} · as of {clock(b.hour, b.minute)}</p>
      </div>
      <section className={s.kitchen} aria-labelledby="kitchen-title">
        <div className={s.head}>
          <div>
            <h1 id="kitchen-title" className={`script ${s.title}`}>The rail, so far</h1>
            <p className={s.sub}>
              Today&rsquo;s numbers, pinned up where the checks hang, from midnight to now. Each is set against last{" "}
              {weekday} at the same time, so a slow morning isn&rsquo;t compared with a whole day.
            </p>
          </div>
          <dl className={s.rest}>
            {rest.map((k) => {
              const v = METRICS[k].value(b.today);
              return (
                <div key={k}>
                  <dt>{METRICS[k].label}</dt>
                  <dd>{v === null ? "—" : METRICS[k].format(v)}</dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className={`steel-rail ${s.rail}`} aria-hidden="true" />
        <ul className={s.lead}>
          {LEAD_METRICS.map((k) => {
            const m = METRICS[k];
            const v = m.value(b.today);
            return (
              <li key={k} className={s.pinned}>
                <p className={s.label}>{m.label}</p>
                <p className={s.figure}>{v === null ? "—" : m.format(v)}</p>
                <p className={s.vs}>{versus(k, v, m.value(b.lastWeek), weekday)}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={s.floor}>
        <HourChart hours={b.hours} peakHour={b.peakHour} />

        <div className={s.pair}>
          <div>
            <h2 className={s.h2}>When they came</h2>
            <ul className={s.bars}>
              {b.dayparts.map((d) => (
                <li key={d.name}>
                  <span>{DAYPART_LABEL[d.name]}</span>
                  <span className={s.track}><span style={{ width: `${(d.orders / dayMax) * 100}%` }} /></span>
                  <b>{d.orders}</b>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className={s.h2}>What they had</h2>
            <ol className={s.bars}>
              {b.top.map((t) => (
                <li key={t.itemId}>
                  <span>{t.name}</span>
                  <span className={s.track}><span style={{ width: `${(t.qty / topMax) * 100}%` }} /></span>
                  <b>{t.qty}</b>
                </li>
              ))}
              {b.top.length === 0 && <li><span>Nothing yet today</span></li>}
            </ol>
          </div>
        </div>

        <ExportSales from={addDays(b.date, -27)} to={b.date} />

        <p className={s.source}>
          Of today&rsquo;s {b.today.orders.toLocaleString("en-US")} orders, <b>{b.today.visitorOrders}</b>{" "}
          {b.today.visitorOrders === 1 ? "was" : "were"} placed by
          visitors on this site and {sim.toLocaleString("en-US")} by the simulator, which writes each day ahead of time;
          nothing here counts an order before its moment comes.
        </p>
        <p className={s.source}>
          How the shop is built and tested, claim by claim against the résumé, is in{" "}
          <Link href="/office">the back office</Link>.
        </p>
      </section>
    </main>
  );
}
