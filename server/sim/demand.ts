// How busy the counter is. Every number the back office shows (the rush, the lull, takings by
// daypart, how long people wait) inherits the shape this function gives the day.

const bump = (hour: number, peak: number, width: number) => Math.exp(-((hour - peak) ** 2) / (2 * width ** 2));

/**
 * Expected orders in the hour that starts at `hour`.
 *
 * @param at.hour    0..23 on Austin's clock (the shop never closes, see docs/decisions/0001)
 * @param at.weekday 0 = Sunday
 * @returns the mean number of orders for that hour; the simulator draws the real count around it
 */
export function demandAt({ hour, weekday }: { hour: number; weekday: number }): number {
  // TODO(Alex): this is the shop's personality, so it is yours to shape. The default below is a
  // commuter shop that never closes: a sharp 8 am rush, a small lunch bump, a quiet afternoon,
  // weekends that start later and run flatter, and a trickle of night owls (about two an hour)
  // between 9 pm and 6 am. Things you might want instead, or as well:
  //   - a 3 pm cold-brew bump (Austin heat), or a Friday that beats Monday;
  //   - a Saturday farmers'-market spike that dwarfs any weekday;
  //   - a slow Monday, so the report has a "worst day" worth explaining;
  //   - a late-night bump when the bars on South Congress let out.
  const night = hour < 6 || hour >= 21;
  const base = night ? 2 : 5;
  const weekend = weekday === 0 || weekday === 6;
  if (weekend) return base + 30 * bump(hour, 10, 2.2) + 8 * bump(hour, 14, 1.6) + 4 * bump(hour, 19, 1.5);
  return base + 44 * bump(hour, 8, 1.1) + 16 * bump(hour, 12.5, 1.2) + 7 * bump(hour, 15.5, 1.4) + 3 * bump(hour, 18.5, 1.2);
}

/**
 * Orders the bar can make in an hour without a queue building. Two baristas by day, one
 * overnight; waits in the simulator grow once the hour's orders pass this.
 */
export function capacityAt(hour: number): number {
  return hour >= 6 && hour < 21 ? 38 : 16;
}
