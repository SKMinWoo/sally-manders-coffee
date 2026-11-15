import s from "./page.module.css";

const label = (h: number) => (h === 0 ? "12 am" : h < 12 ? `${h} am` : h === 12 ? "12 pm" : `${h - 12} pm`);

/**
 * Orders by Austin hour: one series, so one colour and no legend. Hours still to come are shown as
 * a faint stub so the day's shape reads; the peak is labelled directly. Each bar has a hover and
 * focus tooltip, and the same figures are in a table for screen readers.
 */
export function HourChart({ hours, peakHour }: { hours: (number | null)[]; peakHour: number | null }) {
  const max = Math.max(1, ...hours.map((n) => n ?? 0));
  return (
    <figure className={s.chart}>
      <figcaption className={s.h2}>Orders by the hour</figcaption>
      <ol className={s.plot} aria-hidden="true">
        {hours.map((n, h) => (
          <li key={h} className={n === null ? s.later : h === peakHour ? s.peak : undefined} data-tip={n === null ? undefined : `${label(h)}: ${n} order${n === 1 ? "" : "s"}`}>
            {h === peakHour && n !== null && (
              // just after midnight the first hour is the peak: keep its label on the page
              <span className={`${s.peakLabel} ${h < 3 ? s.alignStart : h > 20 ? s.alignEnd : ""}`}>Busiest, {n}</span>
            )}
            <span className={s.bar} style={{ height: n === null ? undefined : `${Math.max(n ? 2 : 0, (n / max) * 100)}%` }} />
          </li>
        ))}
      </ol>
      <div className={s.axis} aria-hidden="true">
        {[0, 6, 12, 18].map((h) => (
          <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{label(h)}</span>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>Orders by the hour, today so far</caption>
        <thead><tr><th>Hour</th><th>Orders</th></tr></thead>
        <tbody>
          {hours.map((n, h) => n !== null && <tr key={h}><td>{label(h)}</td><td>{n}</td></tr>)}
        </tbody>
      </table>
    </figure>
  );
}
