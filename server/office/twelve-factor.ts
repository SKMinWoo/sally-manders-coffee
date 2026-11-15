// The twelve factors (12factor.net), each with what the shop does about it, the files that show it,
// and where it falls short. /office/twelve-factor prints this; a test checks every path still exists,
// so a file that moves can't leave the page pointing at nothing.

export type Factor = {
  n: number;
  name: string;
  /** what the factor asks, in a line */
  asks: string;
  /** what the shop does */
  here: string;
  evidence: { label: string; path: string }[];
  /** where the shop falls short of it, said plainly; null when it doesn't */
  gap: string | null;
};

export const FACTORS: Factor[] = [
  {
    n: 1,
    name: "Codebase",
    asks: "One codebase in version control, many deploys.",
    here: "One repository. Every pull request gets its own preview deployment and main is production, all built from the same code.",
    evidence: [{ label: "CI, on every push and pull request", path: ".github/workflows/ci.yml" }],
    gap: null,
  },
  {
    n: 2,
    name: "Dependencies",
    asks: "Declare every dependency explicitly and isolate them.",
    here: "Exact versions in package.json, locked with integrity hashes, installed with npm ci and with install scripts switched off. CI checks the registry signatures before anything runs.",
    evidence: [
      { label: "package.json", path: "package.json" },
      { label: "The lockfile", path: "package-lock.json" },
      { label: "save-exact, ignore-scripts", path: ".npmrc" },
    ],
    gap: null,
  },
  {
    n: 3,
    name: "Config",
    asks: "Keep config that varies between deploys in the environment.",
    here: "The database and the three secrets are environment variables, listed with what each is for. Nothing in the repository holds a real value.",
    evidence: [
      { label: "What the environment must hold", path: ".env.example" },
      { label: "DATABASE_URL, read on first use", path: "server/platform/db/client.ts" },
    ],
    gap: null,
  },
  {
    n: 4,
    name: "Backing services",
    asks: "Treat the database and other services as attached resources.",
    here: "Postgres is attached by its URL. The same repository code runs on Neon in production and on PGlite, an in-process Postgres, in tests and local development; changing which one is configuration, not code.",
    evidence: [
      { label: "One Db type, two attachments", path: "server/platform/db/client.ts" },
      { label: "The tests' database", path: "server/platform/db/test-db.ts" },
    ],
    gap: "PGlite is real Postgres, but not Neon's HTTP driver; a behaviour only that driver has would only show up on a preview deployment.",
  },
  {
    n: 5,
    name: "Build, release, run",
    asks: "Keep building, releasing and running strictly apart.",
    here: "next build makes an immutable build; Vercel releases it as a deployment with its own URL, and a deployment never changes once made. Rolling back is pointing production at an earlier one.",
    evidence: [{ label: "The build step in CI", path: ".github/workflows/ci.yml" }],
    gap: "Migrations are still run by hand before a release that needs one. Exhibit 8 puts them in the pipeline, between the checks and the deploy.",
  },
  {
    n: 6,
    name: "Processes",
    asks: "Run as stateless processes; keep state in a backing service.",
    here: "Every request handler is a function holding no state between requests. Orders, the rate limit on visitor orders and CI's figures all live in Postgres, so any instance can serve any request.",
    evidence: [
      { label: "Rate limiting by the database", path: "server/orders/place.ts" },
      { label: "The schema: all the state there is", path: "server/platform/db/schema.ts" },
    ],
    gap: null,
  },
  {
    n: 7,
    name: "Port binding",
    asks: "Export services by binding to a port.",
    here: "The app is self-contained: next start serves it on a port of its own, with no web server in front. In production Vercel's runtime does the binding.",
    evidence: [{ label: "The start script", path: "package.json" }],
    gap: "On Vercel the port belongs to the platform, not the app. Exhibit 11's container runs next start itself.",
  },
  {
    n: 8,
    name: "Concurrency",
    asks: "Scale out by running more processes.",
    here: "Vercel runs as many function instances as traffic needs. Because nothing is kept in a process, a second instance needs no coordination with the first.",
    evidence: [{ label: "The handlers: plain functions", path: "server/api/v1.ts" }],
    gap: "The shop's traffic has never needed more than one instance, so this is by design, not measured. Exhibit 7's load test is where it gets measured.",
  },
  {
    n: 9,
    name: "Disposability",
    asks: "Start fast, shut down gracefully, and survive being killed.",
    here: "The daily job writes days that are missing and skips the rest, so a run killed halfway is finished by the next. CI's reports are stored once per run however often it retries. A simulated day is marked written only after its last order is in, and a day found half-written is cleared and written again, the same day, since the simulator is seeded.",
    evidence: [
      { label: "The daily job", path: "app/api/cron/simulate/route.ts" },
      { label: "Writing a simulated day", path: "server/simulator/repository.ts" },
      { label: "Stored once per run", path: "server/office/repository.ts" },
    ],
    gap: null,
  },
  {
    n: 10,
    name: "Dev/prod parity",
    asks: "Keep development, staging and production as alike as possible.",
    here: "One schema, migrated the same way everywhere; one seeded simulator, so a date comes out the same in development, in tests and in production; the browser tests drive the production build itself, `next start`, not the dev server; and a preview deployment for every pull request, on the same platform as production.",
    evidence: [
      { label: "The migrations", path: "drizzle.config.ts" },
      { label: "The browser tests, on the production build", path: "playwright.config.ts" },
      { label: "Days written ahead, seeded by date", path: "docs/decisions/0002-days-written-ahead.md" },
      { label: "The development database", path: "server/platform/db/local.ts" },
    ],
    gap: "Development runs on PGlite rather than Neon (see factor 4).",
  },
  {
    n: 11,
    name: "Logs",
    asks: "Write logs to stdout as an event stream; don't manage files.",
    here: "Errors go to stderr with what failed, and the platform collects them. The app never opens a log file.",
    evidence: [{ label: "The one place API errors are logged", path: "server/platform/http.ts" }],
    gap: "Only failures are logged, as plain lines, not structured events. Enough for a shop this size; a real one would want a request id on every line.",
  },
  {
    n: 12,
    name: "Admin processes",
    asks: "Run one-off admin tasks against a release, with its code and config.",
    here: "The backfill and the migrations are scripts in the repository that use the app's own code and read the same DATABASE_URL. The backfill skips days already written, so running it twice is safe.",
    evidence: [
      { label: "The backfill", path: "scripts/backfill.ts" },
      { label: "The migrations", path: "drizzle.config.ts" },
    ],
    gap: null,
  },
];
