# 9. The owner's calls: the shop's personality, policy and manners

Date: 2026-11-26 · Status: proposed, for Alex's sign-off

## Context

Ten places in the code were left as `TODO(Alex)`: choices that are the shop owner's, not the
code's. Two of them were load-bearing. The coverage gate returned no bar, so it could never fail,
and the export's no-op check always said "something changed", so "Nothing changed" never happened.
A third left a test marked todo, which the proof page counted as failing. Each is settled here, and
each place in the code points back to this record.

## Decision

**The coverage bar** (`scripts/ci/coverage-bar.mjs`): lines ≥ 90% and branches ≥ 80%, over every
module in `lib/` and `server/`, tested or not. GM held 80%+. The shop sits at 97% lines and 86%
branches, so the bar is above GM's and a little under where the code is, leaving room for honest
new code. Branches get their own floor because a line can run without its other branch ever taken.

**Nothing changed** (`server/reporting/export/nothing-new.ts`): a repeat export is unchanged only
when it asks for the same span and the span's order count, line count, newest order id and line
total all match the tag. Orders are only ever added; a half-written day is cleared and rewritten
under new ids, which moves the newest id. So matching marks mean the same rows.

**How busy the shop is** (`server/simulator/demand.ts`): a commuter shop that is never empty. The
quietest hour expects at least six orders (one every ten minutes), the day 330 to 390, and the
rush stays within 6.5 times the lull, so the model always has someone walking in. The rush is
gentler (about 40 an hour at 8 am, against 49 before) and the lunch bump the same shape. Days
already in the database keep the shape they were written with; the fingerprint test is re-pinned.

**What keeps a change on the board** (`server/board/verdict.ts`): better means the typical or the
slowest wait fell by 3% or more, or takings rose 1% or more; worse means the typical wait grew by
over 5%, or takings fell by over 1%. A change that adds barista hours must also cut the typical wait
in its hours by 5% for each extra hour a day. Takings can't buy a much slower wait.

**Sally's entrance** (`components/sally/SallyIntro.tsx`): once per visit, on whichever page the
visitor lands; the rest of the visit she is at rest, and hovering still replays the wink.

**The roof** (`components/front/roof.ts`): arriving from the portfolio's Study always lifts it.
Otherwise it lifts the first time the shop is opened in a browser session, and arrives open after.

**The rail's three figures** (`app/behind/metrics.ts`): takings, orders and the slowest 1 in 20
waits (p95). The first two say busy; the p95 says run well.

**Who sits down** (`lib/footfall.ts`): two or more items stays; one in three of the rest too,
picked by the order's hash. Eight chairs, claimed one guest each.

**The fixture groups** (`components/front/fixtures.ts`): in the order the system would be talked
through in an interview, starting with what a visitor touches first.

## Consequences

- The coverage gate can fail a pull request now, and the proof page shows the rule and the verdict.
- A second export of an unchanged span is a 304 with no workbook built.
- The board's evening-barista lever still comes back "taken back": with the night floor raised, an
  evening hour sometimes passes what one barista makes, so a second one helps a little, but not
  the 10% its two hours must find.
- Every new simulated day is busier at night and a little calmer at the rush. Figures compared
  against last week will show the change for one week.
