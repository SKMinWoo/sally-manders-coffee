# 5. A model writes the morning brief; it never writes a number

Date: 2026-11-15 · Status: accepted

## Context

Exhibit 9 stands in for GM's work on AI developer adoption. Its visible half is a manager's brief:
each morning, a few sentences on yesterday for the team. A language model writes better notes
than a template does, but it also writes numbers that look right and aren't. On a page whose whole
point is that every figure is measured, one invented number would undo the rest.

## Decision

The model is given yesterday's figures, each with a key, and writes `{orders}` where a figure goes.
It is told never to write a number itself. Its draft then goes to a guard
(`server/brief/guard.ts`), which keeps it only if:

- every `{key}` in it is one of the day's figures;
- outside the braces there is no digit of any script (`\p{N}`, so "½" and "٣" count);
- and no number is spelled out ("twice", "dozen", "half"). "one" is allowed, because "no one"
  and "one of" are ordinary words.

The figures are filled in from the database when the brief is shown, and stored with it, so a
number in a brief is always the database's. A draft the guard turns back is not retried. The
template is stored in its place, with the reason, and the template is held to the same rule.

The model is Gemini's free tier (`GEMINI_API_KEY`, `GEMINI_MODEL`, default `gemini-flash-lite-latest`). The lite model was chosen by timing: on the free tier it wrote a brief in about a second, while `gemini-flash-latest`, a thinking model, timed out at 90 seconds or answered 503 on every try.
It is called with `fetch`, not an SDK, so the shop takes on no dependency. With no key, nothing is
sent anywhere and the template writes every brief. A local database always uses the template.

The brief is its own module, `server/brief`, which may use only `reporting`. The back office may
use it for its counts. It is a sixth module, because the model call and the briefs table belong to
neither reporting, which only reads, nor the office.

## Consequences

- No number on the page can be the model's. The guard can't check reasons, though: a draft that
  blamed the rain would pass. The prompt forbids causes, and the page says what is checked.
- The rule is strict, so some honest drafts are turned back ("the top three sellers"). The count is
  shown on /office rather than hidden, and a turned-back day still gets a correct brief.
- The free tier can run out (429) or be busy (503). Those days fall back to the template too, and
  they're counted apart from the guard's refusals, so the figure for the guard means what it says.
