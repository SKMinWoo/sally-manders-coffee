// The figures CI measures and posts to /api/ingest/ci. Each kind has its own strict schema, so a
// misspelt field or a string where a count belongs is refused at the door instead of stored and
// shown. A new exhibit adds its kind here, and nowhere else.

import { z } from "zod";

/** The repository whose Actions runs may report figures. Public, so not a secret. */
export const REPO = "SKMinWoo/sally-manders-coffee";

const Count = z.int().nonnegative();
const Percent = z.number().min(0).max(100);
const Severities = z.strictObject({ critical: Count, high: Count, moderate: Count, low: Count });

export const FACT_KINDS = {
  /** `npm test` on main: the unit, repository and API contract tests (node:test). */
  "unit-tests": z.strictObject({ passed: Count, failed: Count, skipped: Count, durationMs: Count }),
  /**
   * `npx playwright test` on main: the browser tests (e2e/), each run once per project. A run that
   * failed and then passed on its retry is flaky, counted apart from the clean passes.
   */
  "ui-tests": z.strictObject({
    tests: Count,
    projects: z.array(z.string().regex(/^[a-z0-9-]{1,32}$/)).min(1).max(8),
    runs: Count,
    passed: Count,
    flaky: Count,
    failed: Count,
    skipped: Count,
    durationMs: Count,
  }),
  /**
   * The barcode tests (e2e/barcode.spec.ts) on main: barcodes read back from screenshots, of real
   * order pages and of a generated sheet, and damaged ones that had to be refused. A misread is
   * any barcode read as something it doesn't say, damaged or not.
   */
  barcodes: z.strictObject({
    read: Count,
    onPages: Count,
    unread: Count,
    misread: Count,
    damaged: Count,
    refused: Count,
    durationMs: Count,
  }),
  /**
   * The test gap on a push to main (scripts/ci/test-gap.mjs): of the lines the push changed in
   * lib/ and server/ that can run, how many no test ran, across how many files.
   */
  "test-gap": z.strictObject({ changed: Count, uncovered: Count, files: Count }),
  /**
   * The release gate on main (scripts/ci/release-gate.mjs): each gate's outcome, the verdict, the
   * screenshot baselines compared (null: they didn't run), and checkout to verdict in ms.
   */
  "quality-gates": z.strictObject({
    passed: z.boolean(),
    gates: z
      .array(z.strictObject({ name: z.string().regex(/^[A-Za-z0-9 -]{1,40}$/), outcome: z.enum(["success", "failure", "skipped", "cancelled"]) }))
      .min(1)
      .max(16),
    baselines: z.strictObject({ compared: Count, matched: Count }).nullable(),
    durationMs: Count,
  }),
  /** Node's coverage of every module in lib/ and server/, and the gate's verdict (null: no bar set yet). */
  coverage: z.strictObject({
    lines: Percent,
    branches: Percent,
    functions: Percent,
    files: Count,
    gate: z.strictObject({ rule: z.string().min(1).max(120), passed: z.boolean() }).nullable(),
  }),
  /** What the security tools say about main. null: that tool hasn't analysed this repository yet. */
  security: z.strictObject({
    codeScanningOpen: Count.nullable(),
    audit: z.strictObject({ production: Severities, all: Severities }),
    sonarGate: z.enum(["OK", "WARN", "ERROR"]).nullable(),
  }),
  /** The sales export streamed from a fixed 90-day simulated history, and a 14-day one to compare. */
  export: z.strictObject({
    days: Count,
    rows: Count,
    bytes: Count,
    durationMs: Count,
    /** the most live (collected) JS heap seen while streaming, in MB */
    heapPeakMb: z.number().nonnegative().max(4096),
    baseline: z.strictObject({ days: Count, rows: Count, heapPeakMb: z.number().nonnegative().max(4096) }),
  }),
  /**
   * The load test on main (load/shop.jmx, scripts/ci/load-facts.mjs): JMeter's visitors against the
   * built app and a seeded Postgres reached through Neon's proxy. Each endpoint slowest at P95 first.
   */
  "load-test": z.strictObject({
    requests: Count,
    errors: Count,
    durationMs: Count,
    users: Count,
    /** the pace JMeter was held to, in requests a minute */
    perMinute: Count,
    p95Ms: Count,
    p99Ms: Count,
    seed: z.strictObject({ days: Count, orders: Count }),
    endpoints: z
      .array(
        z.strictObject({
          name: z.string().regex(/^GET \/[A-Za-z0-9/{}._-]*( \([a-z ]{1,24}\))?$/),
          requests: Count,
          errors: Count,
          p50Ms: Count,
          p95Ms: Count,
          p99Ms: Count,
          maxMs: Count,
        }),
      )
      .min(1)
      .max(24),
  }),
  /** The domain boundaries (eslint-rules/boundaries.mjs) applied to every import in the repository. */
  boundaries: z.strictObject({
    modules: Count,
    publicEntries: Count,
    files: Count,
    imports: Count,
    /** imports that land in a module from outside it */
    crossings: Count,
    violations: Count,
    /** each module-to-module dependency in use, "orders→menu" */
    uses: z.array(z.string().regex(/^[a-z]+→[a-z]+$/)).max(64),
    decisions: Count,
  }),
} as const;

export type FactKind = keyof typeof FACT_KINDS;
export type FactValue<K extends FactKind> = z.infer<(typeof FACT_KINDS)[K]>;

const Fact = z.discriminatedUnion(
  "kind",
  Object.entries(FACT_KINDS).map(([kind, value]) => z.strictObject({ kind: z.literal(kind), value })) as unknown as [
    z.ZodObject<{ kind: z.ZodLiteral<FactKind>; value: z.ZodType }>,
  ],
);

const RUN_URL = new RegExp(`^https://github\\.com/${REPO.replace("/", "\\/")}/actions/runs/(\\d+)$`);

/** One CI run's report: which run measured these, at which commit, and the figures. */
export const IngestBody = z
  .strictObject({
    run: z.strictObject({
      id: z.int().positive(),
      url: z.string().regex(RUN_URL, `Must be a run of ${REPO}`),
      sha: z.string().regex(/^[0-9a-f]{40}$/, "A full 40-character commit sha"),
    }),
    facts: z.array(Fact).min(1).max(Object.keys(FACT_KINDS).length),
  })
  .refine((b) => b.run.url.endsWith(`/runs/${b.run.id}`), { message: "run.url must be the run named by run.id", path: ["run", "url"] })
  .refine((b) => new Set(b.facts.map((f) => f.kind)).size === b.facts.length, { message: "One fact per kind per run", path: ["facts"] });

export type IngestBody = z.infer<typeof IngestBody>;
