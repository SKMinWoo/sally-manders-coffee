import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CLAIMS } from "./claims";

// /office and /api/v1/engineering quote the résumé "word for word". resume.txt is the PDF's text
// (Alexander_Kim_Resume_Web_v2.pdf, 2026-11-23), so a résumé edit means replacing it, and any quote
// that drifts from it, or a claim Alex has retracted, fails here instead of in front of a recruiter.

const flat = (s: string) => s.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
const RESUME = flat(readFileSync(join(__dirname, "resume.txt"), "utf8"));

test("every claim quotes its résumé bullet whole, word for word", () => {
  for (const c of CLAIMS) {
    const quote = flat(c.gm);
    assert.ok(RESUME.includes(quote), `${c.id}: not in the résumé: ${quote.slice(0, 60)}…`);
    // whole: it starts at a bullet's lead-in and ends at its full stop
    assert.match(quote, /^[A-Z][\w &/-]+: /, `${c.id}: starts mid-bullet`);
    assert.match(quote, /\.$/, `${c.id}: stops mid-bullet`);
  }
});

const RETRACTED = [/81%/, /2\.97/, /0\.55s/, /24,700/, /took over/i, /since 2019/i, /since 2022/i, /5\.29%/, /172K/i, /Sev-1/i, /CQRS/, /MediatR/];

test("no claim Alex has retracted is quoted or restated", () => {
  const said = readFileSync(join(__dirname, "claims.ts"), "utf8");
  for (const r of RETRACTED) assert.doesNotMatch(said, r);
});
