# 1. The shop never closes

Date: 2026-11-14 · Status: accepted

## Context

Sally Mander's is visited by people reading a résumé, from any time zone. A real South Austin café
opens around 6 am and shuts around 6 pm Central, which is midday to midnight UTC. A visitor in
Europe or Asia would often find the shop shut, the order button asleep and the back office frozen
at yesterday's close.

## Options

- **Honest hours:** closed outside 6 am to 6 pm, with orders queued for opening. True to life,
  but half the visitors would see a shop with nothing happening.
- **The visitor's clock:** replay the day on each visitor's local time. Always lively, but two
  visitors at once would see two different shops, and the API could not give one answer.
- **Always open:** one shop on Austin time, serving around the clock with a quiet overnight trickle.

## Decision

Always open. The day is still Austin's local calendar day (America/Chicago), so "today" means
the same thing on the storefront, in the back office and in the API. The demand curve keeps a
real café's shape (the morning rush, a lunch bump) and adds a small overnight trade.

## Consequences

- The simulator models all 24 hours, and the day has 23 or 25 hours across daylight-saving
  changes, which the generator has to get right.
- Overnight hours need fewer baristas in the wait model, or waits at 3 am would look absurd.
