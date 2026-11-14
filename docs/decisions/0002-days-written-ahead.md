# 2. Simulated days are written ahead, and every read stops at now

Date: 2026-11-14 · Status: accepted

## Context

The shop should look live all day: orders arriving, the rail filling up, the back office moving.
It runs on Vercel's free Hobby plan, where a scheduled job can run at most once a day.

## Decision

Once a day, the cron job writes the whole of today and tomorrow ahead of time, each simulated order
with the minute it will be "placed" and the minute it will be ready. Every read filters
`placed_at <= now()`, so an order only exists for a visitor once its minute has come. Writing two
days means one missed run leaves no gap.

Generation is seeded by the date, so the same day always comes out the same and can be rebuilt
or tested exactly.

## Consequences

- The database holds the future, so a read path that forgets the filter would leak orders that
  "haven't happened". All reads of orders go through one helper that applies it, and a test
  checks every repository function against an order placed a minute from now.
- A visitor's order and the simulator's live side by side: visitor orders are written when they
  happen, with `source = 'visitor'` and their own ticket series (`A-01`, `A-02`, …), so they never
  collide with tickets the simulator has already written.
- The API rejects future dates with a 404 rather than returning an empty day.
