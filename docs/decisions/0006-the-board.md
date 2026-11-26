# 6. A manager and a regular call every morning; code decides what changes

Date: 2026-11-23 · Status: accepted

## Context

The shop should be seen to improve itself the way a real one does: a customer says what they
thought, the manager decides what to try, the change runs, and it is measured and kept or taken
back. Two agents do the talking, a regular and a manager, and a public board (`/board`) shows the
work in progress.

The simulator sets three limits on this. A simulated day is a function of its date only. A written
day never changes (0002). And no figure on the site may be a model's (0005). So a change can only
reach the first day not yet written, it has to be something the simulator can model, and the agents
may talk about figures but never produce them.

## Decision

**The changes are a fixed catalogue of levers** (`server/simulator/levers.ts`). Each one is on or
off and changes a named knob: a third barista from 7 to 10 am, prep ahead, a pickup shelf, a pastry
offered at the till, a cold-brew sign from 2 to 5 pm, and a second barista until 11 pm. Each has a
cost or a risk, so it can lose. `simulateDay(date, levers)` applies the levers in effect. `sim_days.levers`
stores the levers a day was written with, so a half-written day is finished the same way.

**The day runs in this order.** `/api/cron/standup` runs at 08:30 UTC, half an hour before the
simulate cron:

1. A change whose week is over is measured.
2. One of four regulars, picked by the day, talks about their visit yesterday. Their figures are
   scoped to that visit: their hour, their wait and their usual. When a change touches their hour,
   its effect so far is added.
3. The manager answers and decides: hold, or try one lever.
4. The simulate cron then writes today and tomorrow with the plan (`leverPlan`).

**The model proposes; the repository decides.** The manager's choice stands only if it is a lever
in the catalogue, nothing else is live, it isn't already kept, and it isn't resting: a rolled-back
lever waits 14 days. Otherwise the manager holds, and the refusal is recorded with the call. Both
notes go through the brief's guard (0005). A note that fails the guard is replaced by the template,
but a valid decision still stands. With no `GEMINI_API_KEY`, templates write both calls, and each
call says who wrote it.

**The verdict compares the week with the same week replayed.** A change runs seven days. It is
measured against the same seven days replayed in memory without it. From the moment levers are
passed, every hour and every order draws from its own random stream. So the replay has the same
guests, ordering the same things, wherever the change didn't alter them (common random numbers).
Days written before this keep the single stream; a fingerprint test pins them byte for byte.
`shouldKeep` in `server/board/verdict.ts` turns the effect into kept or taken back. The rule is
the shop's policy and is set out in decision 0009: something got better, nothing got worse, and a
change that adds barista hours has to cut the wait enough to earn them.

**Planned and trying are dates, not states.** An experiment is live or measured. The board derives
planned (it starts after today) and trying (day n of 7) from its dates, so a missed cron can't
leave a stale status behind.

**A database that has never had a morning rehearses a fortnight** (`server/board/rehearse.ts`).
This is the local dev database and the browser tests' own, and they get it on first open. The
rehearsal runs the same standup and simulate steps, a day at a time. Production never rehearses:
its board starts empty and fills one morning at a time.

`board` is a seventh domain module. It may use `menu`, `simulator`, `reporting` and `brief`
(amending 0004). The board is served as data at `/api/v1/board`.

## Consequences

- A visitor can follow a change from the call that raised it, through the decision and its week, to
  the measurement. Every figure on the way links to the API that gave it.
- The control week is exact, which no real shop can have. The page says so.
- The catalogue is small, so the manager runs out of levers to try after about two months (kept
  levers stay kept, and rolled-back ones rest). After that, it holds until the catalogue grows.
- The evening barista can't win: the evening load stays below the point where the queue builds.
  It is kept as an honest lever that should lose.
- The written days are fixed, so a lever reaches the shop a day after it's chosen at the soonest.
  The board shows that day as planned.
