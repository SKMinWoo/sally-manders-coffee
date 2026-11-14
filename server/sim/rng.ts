// A small seeded random source, so a date always simulates to the same day. mulberry32 is fast
// and plenty for a pretend till; it is not for anything that needs to be unpredictable.

export interface Rng {
  /** uniform in [0, 1) */
  next(): number;
  /** a Poisson-distributed count with this mean */
  poisson(mean: number): number;
  /** a standard normal draw */
  gauss(): number;
  /** an item chosen with probability proportional to its weight */
  pick<T>(items: readonly T[], weight: (item: T) => number): T;
}

/** A 32-bit seed from a string (FNV-style mixing), stable across runs and platforms. */
export function seedOf(s: string): number {
  return [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 0x9e3779b9);
}

export function rngFrom(seed: number): Rng {
  let state = seed | 0;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    poisson(mean) {
      // Knuth's method: fine for the small means of an hour at a counter
      let k = 0;
      for (let p = Math.exp(-mean), s = p, u = next(); u > s; s += p) p *= mean / ++k;
      return k;
    },
    gauss() {
      return Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next());
    },
    pick(items, weight) {
      let at = next() * items.reduce((s, x) => s + weight(x), 0);
      for (const x of items) if ((at -= weight(x)) < 0) return x;
      return items[items.length - 1]!;
    },
  };
}
