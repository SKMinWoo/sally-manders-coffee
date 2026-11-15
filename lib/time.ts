// The shop keeps Austin time. A "day" is a calendar date in America/Chicago, which is 23, 24 or
// 25 hours long depending on daylight saving, so hours are found by asking Intl, never by
// adding 24 × 3600 seconds to midnight.

export const SHOP_TZ = "America/Chicago";

/** A calendar date in Austin, "YYYY-MM-DD". */
export type ShopDate = string;

const HOUR_MS = 3_600_000;
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: SHOP_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Austin's calendar date, hour and minute at an instant. */
export function shopClock(at: Date): { date: ShopDate; hour: number; minute: number } {
  const p = Object.fromEntries(parts.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

/** Today's date in Austin. */
export function shopToday(now: Date = new Date()): ShopDate {
  return shopClock(now).date;
}

export function isShopDate(s: string): s is ShopDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
}

/** The date `n` days after `date` (calendar days, so daylight saving does not matter). */
export function addDays(date: ShopDate, n: number): ShopDate {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday, as Date.getDay. */
export function weekdayOf(date: ShopDate): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/**
 * Every clock hour of an Austin day, in order, with the instant it starts. On the night the
 * clocks go back, 1 am happens twice and both are listed; on the night they go forward, 2 am
 * never happens.
 */
export function hoursOf(date: ShopDate): { hour: number; start: Date }[] {
  const midnightUtc = Date.parse(`${date}T00:00:00Z`);
  const hours: { hour: number; start: Date }[] = [];
  // Austin is 5 or 6 hours behind UTC, so its day lies inside this window. Offsets are whole
  // hours, so stepping by an hour from a whole UTC hour lands on every local hour boundary.
  for (let t = midnightUtc; t < midnightUtc + 32 * HOUR_MS; t += HOUR_MS) {
    const c = shopClock(new Date(t));
    if (c.date === date) hours.push({ hour: c.hour, start: new Date(t) });
  }
  return hours;
}
