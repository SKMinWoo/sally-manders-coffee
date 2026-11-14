// How busy the counter is. Every number the report shows later (the rush, the lull, revenue by
// daypart, how long people wait) inherits the shape this function gives the day.

const bump = (hour, peak, width) => Math.exp(-((hour - peak) ** 2) / (2 * width ** 2));

/**
 * Expected orders in the hour that starts at `hour`.
 *
 * @param {{ hour: number, weekday: number }} at  hour 6..17 (24 h clock); weekday 0 = Sunday
 * @returns {number} mean orders for that hour; the simulator draws the real count around it
 */
export function demandAt({ hour, weekday }) {
  // TODO(Alex): this is the shop's personality, so it is yours to shape. The default below is a
  // commuter shop: a sharp 8 am rush, a small lunch bump, a quiet afternoon, and weekends that
  // start later and run flatter. Things you might want instead, or as well:
  //   - a 3 pm cold-brew bump (Austin heat), or a Friday that beats Monday;
  //   - a Saturday farmers'-market spike that dwarfs any weekday;
  //   - a slow Monday, so the report has a "worst day" worth explaining.
  const weekend = weekday === 0 || weekday === 6;
  if (weekend) return 6 + 30 * bump(hour, 10, 2.2) + 8 * bump(hour, 14, 1.6);
  return 5 + 44 * bump(hour, 8, 1.1) + 16 * bump(hour, 12.5, 1.2) + 7 * bump(hour, 15.5, 1.4);
}
