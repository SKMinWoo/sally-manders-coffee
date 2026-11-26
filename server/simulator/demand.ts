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
  // The shop's personality (decision 0009, proposed): a commuter shop that never closes and is
  // never empty. A rush at 8 that the bar has to work for, a lunch bump, a quiet afternoon and a
  // small after-work trickle; weekends start later and run flatter. The floor is about one guest every ten minutes, all night, so
  // the model always has someone walking in, and the rush stays within 6.5 times the lull.
  const night = hour < 6 || hour >= 21;
  const base = night ? 6.4 : 9;
  const weekend = weekday === 0 || weekday === 6;
  // the night never passes about 40% of what one barista makes, so the evenings still don't queue
  // and the evening-barista lever is still the board's honest "no"
  if (weekend) return base + 24 * bump(hour, 10, 2.2) + 8 * bump(hour, 14, 1.6) + 5 * bump(hour, 19, 1.5);
  return base + 31 * bump(hour, 8, 1.1) + 13 * bump(hour, 12.5, 1.2) + 7 * bump(hour, 15.5, 1.4) + 3 * bump(hour, 18.5, 1.2);
}

/**
 * Orders the bar can make in an hour without a queue building. Two baristas by day, one
 * overnight; waits in the simulator grow once the hour's orders pass this.
 */
export function capacityAt(hour: number): number {
  return hour >= 6 && hour < 21 ? 38 : 16;
}
