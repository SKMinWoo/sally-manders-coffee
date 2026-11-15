// Code 128, set B, written by hand: the barcode on a guest check, and the reader that checks it.
//
// A Code 128 symbol is three bars and three spaces, 11 modules wide, each bar or space 1 to 4
// modules. A barcode is a start symbol, one symbol per character, a check symbol and the stop
// (13 modules, with a final bar), with a quiet zone of at least 10 modules on each side.
// Set B covers printable ASCII, which is all a public order id (lib/ids.ts) needs.
//
// The reader works the way a scanner does: one row of light and dark, cut into runs, each symbol
// measured against its own width, so it copes with any scale, blur at the edges and a check hung
// at an angle. It returns null for anything it can't read with certainty, never a near guess.

/** The widths of each symbol, bar first: values 0 to 102, then start A, B and C (103 to 105). */
const SYMBOLS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232",
] as const;
const STOP = "2331112";
const START_B = 104;
/** The quiet zone each side, in modules: the spec's minimum. */
export const QUIET = 10;

const BY_PATTERN = new Map<string, number>(SYMBOLS.map((p, v) => [p, v]));

/** For the tests: the table as it stands. */
export const TABLE = { symbols: SYMBOLS, stop: STOP };

const value = (ch: string) => {
  const code = ch.charCodeAt(0);
  if (ch.length !== 1 || code < 32 || code > 126) throw new RangeError(`Code 128B has no ${JSON.stringify(ch)}`);
  return code - 32;
};

/** The check symbol: the start's value plus each symbol's value times its position, mod 103. */
const checksum = (values: number[]) => values.reduce((sum, v, i) => sum + v * i, START_B) % 103;

/**
 * The bars and spaces for `text`, as widths in modules, bar first, without the quiet zones.
 * There is always an odd number: the barcode starts and ends on a bar.
 */
export function encode(text: string): number[] {
  if (text.length === 0 || text.length > 48) throw new RangeError("1 to 48 characters");
  const values = [...text].map(value);
  const symbols = [START_B, ...values, checksum([0, ...values])].map((v) => SYMBOLS[v]!);
  return [...symbols, STOP].flatMap((s) => [...s].map(Number));
}

/** The bars alone, each as an x and a width in modules, quiet zone included in x. */
export function bars(text: string): { modules: number; bars: { x: number; w: number }[] } {
  const widths = encode(text);
  const out: { x: number; w: number }[] = [];
  let x = QUIET;
  widths.forEach((w, i) => {
    if (i % 2 === 0) out.push({ x, w });
    x += w;
  });
  return { modules: x + QUIET, bars: out };
}

/**
 * Read one row of pixels across a barcode: each pixel's lightness, any scale. Returns the text,
 * or null when there's no barcode, a symbol doesn't match the table, or the check doesn't add up.
 */
export function decodeRow(row: ArrayLike<number>): string | null {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < row.length; i++) {
    lo = Math.min(lo, row[i]!);
    hi = Math.max(hi, row[i]!);
  }
  if (hi - lo < 64) return null; // no contrast worth reading
  const mid = (lo + hi) / 2;

  // Each edge between light and dark, placed to a fraction of a pixel where the lightness crosses
  // the midpoint: a pixel an edge runs through comes out grey, and how grey says where the edge is.
  const edges: number[] = [];
  for (let i = 1; i < row.length; i++) {
    const a = row[i - 1]!, b = row[i]!;
    if (a < mid !== b < mid) edges.push(i - 1 + (mid - a) / (b - a));
  }
  if (row[0]! < mid) edges.shift(); // the row starts inside a bar: not a whole barcode
  if (edges.length % 2) edges.pop(); // nor does it end inside one
  // the runs of dark and light, from the first bar to the last
  const runs = edges.slice(1).map((e, i) => e - edges[i]!);

  // start, at least one character, check, stop: 6 runs a symbol and 7 for the stop
  const count = (runs.length - 7) / 6;
  if (!Number.isInteger(count) || count < 3) return null;

  // one symbol's runs as modules, measured against the symbol's own width
  const read = (from: number, n: number, modules: number) => {
    const part = runs.slice(from, from + n);
    const unit = part.reduce((a, b) => a + b, 0) / modules;
    const widths = part.map((r) => Math.round(r / unit));
    if (widths.some((w) => w < 1 || w > 4) || widths.reduce((a, b) => a + b, 0) !== modules) return null;
    return widths.join("");
  };

  const values: number[] = [];
  for (let s = 0; s < count; s++) {
    const pattern = read(s * 6, 6, 11);
    const v = pattern === null ? undefined : BY_PATTERN.get(pattern);
    if (v === undefined) return null;
    values.push(v);
  }
  if (read(count * 6, 7, 13) !== STOP) return null;
  const data = values.slice(1, -1); // the check, last, may be any value up to 102
  if (values[0] !== START_B || data.some((v) => v > 94)) return null; // set B, printable characters only
  if (checksum([0, ...data]) !== values.at(-1)) return null;
  return String.fromCharCode(...data.map((v) => v + 32));
}
