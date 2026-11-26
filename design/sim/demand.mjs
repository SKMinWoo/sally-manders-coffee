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
  // The first, aggregate-only simulator the mockups were filled from, kept as it was. The app's
  // demand curve is server/simulator/demand.ts (decision 0009).
  const weekend = weekday === 0 || weekday === 6;
  if (weekend) return 6 + 30 * bump(hour, 10, 2.2) + 8 * bump(hour, 14, 1.6);
  return 5 + 44 * bump(hour, 8, 1.1) + 16 * bump(hour, 12.5, 1.2) + 7 * bump(hour, 15.5, 1.4);
}
