// When the street is quiet (the small hours, or a database that missed a day), the model replays the
// busiest quarter hour of the last day instead of standing empty, and says so. The replay's guests
// are the stored orders of that quarter hour, moved onto the clock: none is invented, and none counts
// towards a figure.

/** Fewer orders than this in the last quarter hour, and the model plays a replay. */
export const QUIET = 5;
/** The replay starts this far back, so the first frame already has a few guests inside. */
export const REPLAY_LEAD_MS = 2 * 60_000;
const QUARTER_MS = 15 * 60_000;

/** The quarter hour with the most orders placed in it: its start, and its orders. */
export function busiestQuarter<T extends { placedAt: number }>(orders: readonly T[]): { from: number; orders: T[] } | null {
  const sorted = [...orders].sort((a, b) => a.placedAt - b.placedAt);
  let best = { from: 0, n: 0, i: 0, j: 0 };
  for (let i = 0, j = 0; i < sorted.length; i++) {
    while (j < sorted.length && sorted[j]!.placedAt < sorted[i]!.placedAt + QUARTER_MS) j++;
    if (j - i > best.n) best = { from: sorted[i]!.placedAt, n: j - i, i, j };
  }
  return best.n ? { from: best.from, orders: sorted.slice(best.i, best.j) } : null;
}

export interface Replay<T> {
  /** when the replayed quarter hour began, on the shop's clock */
  from: number;
  /** the instant the replay is over: its last guest's order is ready */
  until: number;
  orders: (T & { replay: true })[];
}

/**
 * A replay for `now`, or null when the street isn't quiet or there's nothing busier to show: the
 * busiest quarter hour of `day` (the last day's orders), moved so it began REPLAY_LEAD_MS ago, each
 * order's wait kept.
 */
export function replayOf<T extends { placedAt: number; readyAt: number }>(recent: number, day: readonly T[], now: number): Replay<T> | null {
  if (recent >= QUIET) return null;
  const q = busiestQuarter(day);
  if (!q || q.orders.length <= recent) return null;
  const shift = now - REPLAY_LEAD_MS - q.from;
  const orders = q.orders.map((o) => ({ ...o, placedAt: o.placedAt + shift, readyAt: o.readyAt + shift, replay: true as const }));
  return { from: q.from, until: Math.max(...orders.map((o) => o.readyAt)), orders };
}
