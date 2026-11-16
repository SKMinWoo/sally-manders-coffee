# 6. The load test reaches its database the way production does, through Neon's proxy

Date: 2026-11-15 · Status: accepted

## Context

Exhibit 7 stands in for GM's JMeter and Grafana suites, which found the database and API
bottlenecks behind a slow P95. The shop's load test has to find the same kind of thing, and it must
never run against production: Neon's free compute is metered by the hour, and production is what
visitors see.

So it runs in CI, against the built app on `next start` and a Postgres container seeded with a month
of simulated days. The catch is the driver. In production the app talks to Neon over HTTP
(`@neondatabase/serverless`, `drizzle-orm/neon-http`): every query is its own HTTPS request. A plain
Postgres container doesn't speak that.

Three ways were weighed:

- **Neon's own proxy in front of the container**, run from the community image
  `ghcr.io/timowilhelm/local-neon-http-proxy` that Neon's local-development guide points to. The app
  keeps its production driver.
- **A second driver** (`pg` and `drizzle-orm/node-postgres`) used only under load. Pooled TCP
  connections would hide the per-query round trip, which is exactly the cost an extra query adds in
  production.
- **PGlite**, which the browser tests use. It is one connection in WebAssembly, so under twenty
  visitors the P95 would mostly measure the queue in front of it.

## Decision

The proxy. CI starts `postgres:17-alpine` as a job service, then the proxy with `docker run` once
Postgres reports healthy (its start script creates a table, so it can't race Postgres's start).
Both images are pinned by digest. The proxy image was read before it was trusted: it compiles
Neon's `proxy` binary from `neondatabase/neon` at tag `release-proxy-8853`, with Caddy from Caddy's
own apt repository in front to handle a self-signed TLS hop. It is 249 MB compressed and runs only
on GitHub's runners, in a job that holds no secrets.

The app finds it by name: a `DATABASE_URL` whose host is `db.localtest.me` (public DNS for
127.0.0.1) sends queries to `http://db.localtest.me:4444/sql` (`localNeonEndpoint()` in
`server/platform/db/client.ts`). Any other host, and anything on Vercel, keeps the driver's own
endpoint. `scripts/load/prepare.ts` refuses to seed any other host.

JMeter 5.6.3 comes from Apache's archive, checked against its SHA-512. The plan (`load/shop.jmx`)
reads every page and API endpoint the shop serves to a visitor, with a week's sales export in one
visit of twenty. Twenty visitors are held to 100 requests a second for three minutes, below what the
runner can serve, so the P95 measures the endpoints rather than a saturated machine.

The figure is posted to `/office` from main, by its own job, with the per-endpoint P95s charted on
the card. JMeter's HTML report is kept with each run as the artifact `load-report`, in place of
Grafana, which would need an account.

## Consequences

- The numbers are CI's, not production's: a runner and a container on one machine, with no network
  between the app and the database. They rank the endpoints and show what a change does; they are
  not the latency a visitor sees.
- `next start` has no CDN, so the API's `s-maxage` caching doesn't apply and every API request
  reaches the database. The pages' own `unstable_cache` (a minute) does apply.
- The plan only reads. Ordering is a server action, which JMeter can't call without the build's
  action IDs.
- The slowest endpoint it finds is fixed in its own pull request, so the card can show the P95 before
  and after.
