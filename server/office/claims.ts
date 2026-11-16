// The eleven General Motors résumé bullets and the small, running twin each one has here.
// The bullets are word for word from the résumé (alex-kim-portfolio/app/content/experience.ts,
// kept in step with the PDF); `**bold**` marks the figure the résumé leads with. A claim's twin
// is "running" only once its exhibit has shipped and measures something; until then the office
// says so, rather than showing a figure nobody measured.

import { REPO } from "./facts";

export type Role = "Full-Stack Software Engineer" | "Software Development Engineer in Test";

export type Claim = {
  id: string;
  role: Role;
  /** the résumé bullet, verbatim */
  gm: string;
  /** what the shop runs in its place, in a sentence */
  twin: string;
  /** build order: exhibit 1 ships first */
  exhibit: number;
  status: "running" | "coming";
  /** where the code lives, relative to the repository root */
  code: { label: string; path: string }[];
};

const FS: Role = "Full-Stack Software Engineer";
const SDET: Role = "Software Development Engineer in Test";

export const CLAIMS: Claim[] = [
  {
    id: "full-stack",
    role: FS,
    gm: "Architected and shipped full-stack features for mission-critical manufacturing platforms used by **2,000+ people a day** worldwide — C#/.NET Core and Java/Spring Boot services, React/TypeScript front ends.",
    twin: "The shop itself: ordering, the rail, Behind the scenes and a public API, in Next.js and TypeScript on Postgres, with this back office reading the figures CI measures.",
    exhibit: 1,
    status: "running",
    code: [
      { label: "The API's handlers", path: "server/api/v1.ts" },
      { label: "Where CI's figures come in", path: "app/api/ingest/ci/route.ts" },
      { label: "This page", path: "app/office/page.tsx" },
    ],
  },
  {
    id: "excel-export",
    role: FS,
    gm: "Built server-side Excel export and template-generation microservices that handle **20,000+-row workbooks**, with automated validation and no-op detection — ending client memory crashes and data-integrity defects.",
    twin: "“Export sales” on Behind the scenes: an .xlsx of every order line over up to 92 days, written by hand (no spreadsheet library) and streamed from the database a page at a time, so memory stays flat however long the span. Every check is validated before a byte is sent, the workbook is reopened and checked against its own Totals sheet in CI, and each workbook carries a tag so a repeat request can be answered “Nothing changed” (the rule for “nothing new” is still to be set, so until then every request gets a fresh workbook). The shop’s own month is about 12,000 rows, under GM’s 20,000; the 90-day figure is a simulated history streamed in CI.",
    exhibit: 4,
    status: "running",
    code: [
      { label: "The streaming zip", path: "server/reporting/export/zip.ts" },
      { label: "The workbook", path: "server/reporting/export/xlsx.ts" },
      { label: "Keyset paging", path: "server/reporting/sales.ts" },
      { label: "The check", path: "server/reporting/export/check.ts" },
      { label: "No-op detection", path: "server/reporting/export/nothing-new.ts" },
    ],
  },
  {
    id: "performance",
    role: FS,
    gm: "Built JMeter and Grafana performance suites (**24,700+ requests per run**) that exposed database and API bottlenecks; the fixes cut P95 latency on key endpoints from **2.97s to 0.55s — 81% faster**.",
    twin: "A JMeter plan run in CI against the built app and a seeded Postgres, with the P95 of every endpoint it hits, before and after any fix.",
    exhibit: 7,
    status: "coming",
    code: [],
  },
  {
    id: "aks",
    role: FS,
    gm: "Led the migration of **15+ microservices to Azure (AKS)** with Argo CD and Helm, enabling single-origin routing without CORS workarounds.",
    twin: "A container image, a Helm chart and an Argo CD Application, synced into a throwaway Kubernetes cluster in CI and checked through its ingress. One service here, 15+ at GM.",
    exhibit: 11,
    status: "coming",
    code: [],
  },
  {
    id: "re-architecture",
    role: FS,
    gm: "Co-led the ground-up re-architecture of a legacy **Workflow Process System** into 12-factor, cloud-native microservices, with standardized domain boundaries and faster feature delivery.",
    twin: "The server as six domain modules (menu, simulator, orders, reporting, the manager’s brief and this back office), each used only through its one public entry, with their dependencies running one way so none can form a cycle. A lint rule fails the build on any import that reaches inside a module or against the direction, and CI counts every import it checked. Each of the twelve factors is pointed at its evidence, gaps included, and the choices are written down as decision records. It’s one Next.js app, not a fleet of microservices: the boundaries carry over from GM, the network between services doesn’t.",
    exhibit: 10,
    status: "running",
    code: [
      { label: "The boundary rule", path: "eslint-rules/boundaries.mjs" },
      { label: "A public entry", path: "server/orders/index.ts" },
      { label: "Why modules", path: "docs/decisions/0004-domain-modules.md" },
      { label: "The twelve factors", path: "/office/twelve-factor" },
    ],
  },
  {
    id: "devsecops",
    role: FS,
    gm: "Built DevSecOps pipelines across GitHub Actions and Azure DevOps with SonarQube, CodeQL, Dependabot and Wiz — gating on vulnerabilities and holding **80%+ test coverage**.",
    twin: "CodeQL on every pull request and weekly, Dependabot updates with a week’s cooldown, npm audit failing the build on any high-severity hole in what ships, a SonarCloud scan wired in (it switches on once its account is connected), and a coverage gate that counts every module in lib/ and server/, tested or not (the UI’s tests are exhibit 3). No Wiz: it’s a paid product.",
    exhibit: 2,
    status: "running",
    code: [
      { label: "CodeQL workflow", path: ".github/workflows/codeql.yml" },
      { label: "Dependabot", path: ".github/dependabot.yml" },
      { label: "The coverage bar", path: "scripts/ci/coverage-bar.mjs" },
      { label: "The CI gates", path: ".github/workflows/ci.yml" },
    ],
  },
  {
    id: "ai-adoption",
    role: FS,
    gm: "Led cross-functional **AI developer adoption**: custom Glean agents, GitHub Actions and an Azure-hosted AI agent API that cut developer toil, streamlined sprint updates and automated test-gap remediation.",
    twin: "Each morning a model (Gemini’s free tier) writes the manager a short note on yesterday. It never writes a figure: it puts {orders} where one goes, the database fills it in, and a guard turns back any draft with a number of its own, spelled out or in digits, for a template that keeps the same rule. On every pull request, an Action reads the coverage against the diff and names the changed lines no test runs.",
    exhibit: 9,
    status: "running",
    code: [
      { label: "The guard", path: "server/brief/guard.ts" },
      { label: "Asking the model", path: "server/brief/model.ts" },
      { label: "Writing the brief", path: "server/brief/write.ts" },
      { label: "Today’s brief", path: "/behind#brief" },
      { label: "The test-gap Action", path: "scripts/ci/test-gap.mjs" },
      { label: "Why a guard", path: "docs/decisions/0005-the-brief-and-its-guard.md" },
    ],
  },
  {
    id: "barcode",
    role: SDET,
    gm: "Led the architecture and rollout of an automated barcode verification framework, saving **2+ days of manual testing every regression cycle**.",
    twin: "Every order's guest check prints its id as a Code 128 barcode, encoded by hand with no library. The browser suite screenshots real checks, and a sheet of barcodes at three sizes and three angles, on a desktop and a phone, and reads each one back from the pixels; damaged ones have to be refused, never read as something else.",
    exhibit: 5,
    status: "running",
    code: [
      { label: "The encoder and the reader", path: "lib/code128.ts" },
      { label: "The barcode tests", path: "e2e/barcode.spec.ts" },
      { label: "Reading a screenshot's pixels", path: "e2e/png.ts" },
      { label: "The check that prints it", path: "components/shop/GuestCheck.tsx" },
      { label: "How the counts reach this page", path: "scripts/ci/barcode-facts.mjs" },
    ],
  },
  {
    id: "ui-tests",
    role: SDET,
    gm: "Built and scaled **100+ Selenium UI tests** and **300+ end-to-end integration and API tests** running in Azure DevOps CI/CD.",
    twin: "A Playwright suite that orders ahead, waits out the countdown, exports the sales, reads the docs and checks every page on a desktop and a phone, beside the unit and API contract tests, all run on every pull request.",
    exhibit: 3,
    status: "running",
    code: [
      { label: "The order flow, end to end", path: "e2e/order.spec.ts" },
      { label: "The console guard and per-test visitors", path: "e2e/fixtures.ts" },
      { label: "The suite's setup", path: "playwright.config.ts" },
      { label: "How the counts reach this page", path: "scripts/ci/ui-test-facts.mjs" },
    ],
  },
  {
    id: "quality-gates",
    role: SDET,
    gm: "Set up automated quality gates and regression baselines that made release verification **35% faster** across core manufacturing platforms.",
    twin: "Every page is screenshotted whole, on a desktop and a phone, from a server whose clock is stopped so the shop renders the same each run, and compared with the committed picture. A release gate then reads every check, baselines included, and holds the merge to main, which production deploys from, until all of them pass.",
    exhibit: 6,
    status: "running",
    code: [
      { label: "The baselines", path: "e2e/visual.spec.ts" },
      { label: "The stopped clock", path: "server/platform/clock.ts" },
      { label: "The gate's verdict", path: "scripts/ci/release-gate.mjs" },
      { label: "The gates, in order", path: ".github/workflows/ci.yml" },
      { label: "Counting the baselines", path: "scripts/ci/baseline-facts.mjs" },
    ],
  },
  {
    id: "zero-downtime",
    role: SDET,
    gm: "Partnered with backend engineers through release freezes — isolating root causes and running monthly patch validation for **zero-downtime production deploys**.",
    twin: "A pipeline on main: checks, expand-only migrations, the deploy, then a smoke test against the live site, with an uptime probe keeping score.",
    exhibit: 8,
    status: "coming",
    code: [],
  },
];

/** A link to a file on main. */
/** Where the shop is served. Public; also in CI, which posts its figures here. */
export const SITE = "https://sally-manders-coffee.vercel.app";

/** A repository path as its file on GitHub; a path starting with "/" is a page of this site. */
export const codeUrl = (path: string) => (path.startsWith("/") ? `${SITE}${path}` : `https://github.com/${REPO}/blob/main/${path}`);
