// The guard: a draft is kept only if every number in it is the database's. The writer never
// writes a figure. It writes {key} where one goes, and the figures are filled in from the day's
// data afterwards, so the rule is short:
//
//   - every {key} must be one of the day's figures;
//   - outside the braces, no digit of any script (\p{N} also catches "½", "²" and "٣");
//   - and no number spelled out, since "twice as busy" is a figure too.
//
// It checks numbers, not reasons. A draft saying the rain kept people in would pass, which is why
// the prompt forbids causes the figures don't show, and why the page says what the guard checks.
// "one" is allowed, because "no one" and "one of" are how people write; the rest are not.

const NUMBER_WORDS =
  /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|dozen|dozens|half|twice|double|doubled|triple|tripled|percent|quarter)\b/i;

/** Longest body kept: a brief is a few sentences on a note, not a report. */
export const MAX_CHARS = 700;

const KEY = /\{([A-Za-z]+)\}/g;

export type Verdict = { ok: true; body: string } | { ok: false; reason: string };

const no = (reason: string): Verdict => ({ ok: false, reason });
/** Quoting what the writer wrote, short, so a reason can't carry a paragraph of it. */
const quote = (s: string) => `“${s.length > 24 ? `${s.slice(0, 24)}…` : s}”`;

export function guard(draft: string, keys: ReadonlySet<string>): Verdict {
  // markdown emphasis and line breaks are the writer's habits, not words; a note is one paragraph
  const body = draft.replace(/[*_#`]/g, "").replace(/\s+/g, " ").trim();
  if (!body) return no("it was empty");
  if (body.length > MAX_CHARS) return no("it ran past the length of a note");

  let used = 0;
  for (const [, key] of body.matchAll(KEY)) {
    if (!keys.has(key!)) return no(`it used {${key}}, which isn't one of the day's figures`);
    used++;
  }
  if (!used) return no("it used none of the day's figures");

  const words = body.replace(KEY, " ");
  if (/[{}]/.test(words)) return no("it left a brace that isn't a figure");
  const digit = /\S*\p{N}\S*/u.exec(words);
  if (digit) return no(`it wrote ${quote(digit[0])} itself`);
  const spelled = NUMBER_WORDS.exec(words);
  if (spelled) return no(`it spelled out ${quote(spelled[0])}`);
  return { ok: true, body };
}

/** A kept body, split into words and figures, for a page to render each figure as a link. */
export function parts<F extends { key: string }>(body: string, figures: readonly F[]): (string | F)[] {
  const byKey = new Map(figures.map((f) => [f.key, f]));
  // split with a capture group alternates text, key, text, key, …
  return body.split(/\{([A-Za-z]+)\}/).map((s, i) => (i % 2 ? (byKey.get(s) ?? `{${s}}`) : s)).filter((p) => p !== "");
}
