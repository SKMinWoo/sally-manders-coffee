# 7. Production deploys only through a pipeline on main, and every migration only expands

Date: 2026-11-16 · Status: accepted

## Context

Exhibit 11 (numbered 8 when this was written) stands in for GM's release freezes and monthly patch validation, run so that production
deploys caused no downtime. Until now the shop deployed the way Vercel does by default: every push
to main built and went live by itself, whether or not CI passed, and migrations ran by hand.

Vercel already gets one thing right. A new build gets the domain only once it is ready, and the
switch is atomic, so the old build serves every request until then. What it can't know about is
the database. A deploy has two halves, the schema and the code, and they can't change at the same
instant. Whichever goes first, for a minute one runs against the other.

## Decision

The schema goes first, and it may only grow. Main deploys through one job, `deploy` in
`.github/workflows/ci.yml`, after the release gate passes:

1. **Expand-only migrations.** `scripts/ci/expand-only.mjs` refuses any migration that drops,
   renames, retypes or tightens something the live code relies on. A unit test runs it on every
   pull request, and the job runs it again before touching production. A contraction ships in two
   deploys: the code stops using the thing, then a later migration removes it, on a line marked
   `-- contract-ok: <why>`.
2. **Migrate.** `scripts/deploy/migrate.mjs` runs `drizzle-kit migrate`, the same command used by
   hand before, which applies the new migrations in one transaction. It counts the journal before
   and after, and fails if the database doesn't end up with every migration in the repository.
   drizzle-orm's own neon-http migrator was not used: it runs each statement on its own, so a
   failure midway would leave half a migration applied and unrecorded.
3. **Deploy.** `scripts/deploy/ship.mjs` calls a Vercel deploy hook for main. First it checks that
   main still points at this run's commit. A hook builds the branch's newest commit, so if a newer
   push landed, its migrations haven't run yet, and this run stands down for the newer one. Main's
   own Git deploys are turned off (`git.deploymentEnabled` in `vercel.json`), so the pipeline is
   the only way into production. Previews still deploy from every pull request.
4. **Watch the switch.** `/api/v1/health` now names the commit it was built from
   (`VERCEL_GIT_COMMIT_SHA`). The script probes it once a second from the hook until a minute after
   it answers with the new commit. A request that fails or takes over 10 s counts as dropped, and
   the longest wait between two good answers is kept.
5. **Smoke-test.** Every page and read endpoint of the live site must answer 200 with the shop's
   page or JSON.

The figure (migrations applied, push to live, the probe, the smoke test) is posted to `/office` as
the `deploy` kind. The check job's figures and the load test's are now posted after the deploy, not
alongside it. A new kind of figure therefore always reaches code that knows it.

Main's runs no longer cancel each other (pull requests' still do), and the deploy job has its own
`production` concurrency group. Stopping a deploy halfway would leave nobody watching the switch.

**Uptime** is probed every 30 minutes from GitHub's runners (`.github/workflows/uptime.yml`).
Down means no good answer from health twice, 20 s apart. Health reads the database, so a site cut
off from Neon is down too. Once a day the report counts the last 30 days of probe runs from
GitHub's record (`scripts/ci/uptime.mjs`), not from the site's own: a site that was down can't
fail to record it. A probe GitHub dropped or cancelled counts as neither up nor down. Every
30 minutes rather than 5, because health wakes Neon's free compute, and a 5-minute probe would keep
it awake around the clock.

## Consequences

- Production needs two secrets in a GitHub environment named `production`, which only main may
  deploy from: `DATABASE_URL` and `VERCEL_DEPLOY_HOOK`. Without them the deploy job fails, and with
  main's Git deploys off, nothing reaches production.
- A failed smoke test fails the job and is posted, but nothing rolls back on its own. Vercel's
  instant rollback in the dashboard stays the way back. Automating it would need a Vercel token in
  CI, for a case that hasn't happened yet.
- A small race remains. A push can land between the main check and Vercel fetching the branch.
  That newer commit would then build before its run migrates. Expand-only makes it rare and mostly
  harmless: only a commit whose code needs its own new migration would fail, and only until its
  run catches up.
- Uptime is seen from one place, GitHub's runners, at most every half hour, so an outage shorter
  than that can fall between probes. GitHub also delays scheduled runs at busy times, and turns
  schedules off in a public repository after 60 days without a push.
- Not yet proven, until the first deploy from main: that a deploy hook still builds with main's
  Git deploys off (Vercel's documentation doesn't say), and that hook builds set
  `VERCEL_GIT_COMMIT_SHA`. If either fails, the job says so within 15 minutes, and the fix is to
  remove `git` from `vercel.json`.
