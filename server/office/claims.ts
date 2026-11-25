// The eleven General Motors résumé claims and the small, running twin each one has here.
// Each quotes its résumé bullet word for word, lead-in label and all (resume.txt is the PDF's
// text, and claims.test.ts holds every quote to it); a bullet that backs more than one claim is
// quoted whole each time, and `**bold**` marks the part this twin answers. A claim's twin
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
    gm: "Self-service tools: Architected full-stack equipment management (React/TypeScript, Spring Boot REST APIs, PostgreSQL) with bulk edit and Excel import/export, replacing IT-run data requests; users make **~3,150 edits/month** with these tools across 30 plants.",
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
    gm: "Scale & data integrity: JDBC batch writes (50% fewer DB round trips), composite indexes on 600K-row tables, a batched API replacing 460 parallel calls, and **server-side Excel for 20K+ row workbooks with no-op change detection**.",
    twin: "“Export sales” on Behind the scenes: an .xlsx of every order line over up to 92 days, written by hand (no spreadsheet library) and streamed from the database a page at a time, so memory stays flat however long the span. Every check is validated before a byte is sent, the workbook is reopened and checked against its own Totals sheet in CI, and each workbook carries a tag so a repeat request can be answered “Nothing changed” (the rule for “nothing new” is still to be set, so until then every request gets a fresh workbook). The shop’s own month is about 12,000 rows, under GM’s 20K+; the 90-day figure is a simulated history streamed in CI.",
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
    gm: "Performance: Implemented a nightly JMeter suite (**~26K requests/run**, 58 SLA transactions) and built Datadog dashboards whose findings cut p95 latency across services, by up to 42% on some endpoints.",
    twin: "A JMeter plan run in CI on every push: 20 visitors for three minutes, paced to 100 requests a second, read the shop’s pages and its API, served by the built app on next start. Its database is Postgres with a month of the shop in it, reached over HTTP through Neon’s own proxy, the way production reaches Neon, so a query too many costs a round trip here as it does there. No CDN sits in front, so every API request reaches the database, and ordering is a server action, so the plan only reads. GM’s suite fed Datadog dashboards; here JMeter’s own report is kept with each run, and the P95 of every endpoint is charted below. The before and after comes when the slowest of them is fixed.",
    exhibit: 7,
    status: "running",
    code: [
      { label: "The JMeter plan", path: "load/shop.jmx" },
      { label: "The CI job", path: ".github/workflows/ci.yml" },
      { label: "The seeded database", path: "scripts/load/prepare.ts" },
      { label: "P95 by endpoint", path: "scripts/ci/load-facts.mjs" },
      { label: "Why Neon’s proxy", path: "docs/decisions/0006-load-test-through-neons-proxy.md" },
    ],
  },
  {
    id: "aks",
    role: FS,
    gm: "Cloud migration: Drove the move of **15+ microservices and an AI agent** from OpenShift to Azure Kubernetes Service with Helm and Argo CD GitOps; built 5 reusable GitHub Actions workflows (43 PRs, 7 repos).",
    twin: "On every pull request and push to main, CI builds the shop as a container image and makes a throwaway Kubernetes cluster (kind). It installs Argo CD, which reads the Helm chart from GitHub at that commit and syncs it, in order: Postgres, Neon’s proxy in front of it as production has, a Job that migrates and seeds it, then the shop in two pods, each run as an unprivileged user on a read-only file system. CI then asks the shop’s health through its Kubernetes Service, and checks it answers with the commit CI built. One service here, 15+ at GM, and no AKS or Azure: kind runs the same Kubernetes on the runner.",
    exhibit: 11,
    status: "running",
    code: [
      { label: "The container image", path: "Dockerfile" },
      { label: "The Helm chart", path: "deploy/chart/templates/shop.yaml" },
      { label: "The Argo CD Application", path: "deploy/argocd/application.yaml" },
      { label: "The cluster job", path: ".github/workflows/ci.yml" },
      { label: "Why kind, and no ingress", path: "docs/decisions/0008-the-shop-on-kubernetes.md" },
    ],
  },
  {
    id: "re-architecture",
    role: FS,
    gm: "Modernization: Led re-platforming of 4 app instances from Pivotal Cloud Foundry (PCF) to Kubernetes (containerized .NET, 21 Azure DevOps pipelines); **co-led re-architecture of a legacy workflow system into 12-Factor microservices**.",
    twin: "The server as seven domain modules (menu, simulator, orders, reporting, the manager’s brief, the board and this back office), each used only through its one public entry, with their dependencies running one way so none can form a cycle. A lint rule fails the build on any import that reaches inside a module or against the direction, and CI counts every import it checked. Each of the twelve factors is pointed at its evidence, gaps included, and the choices are written down as decision records. It’s one Next.js app, not a fleet of microservices: the boundaries carry over from GM, the network between services doesn’t.",
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
    gm: "DevSecOps: Led supply-chain hardening across 15 repos (44 PRs): Chainguard images for 11 services, critical Wiz CVEs, 34+ Dependabot alerts, CodeQL; restored CI for 13 repos same day via keyless JFrog OIDC; **held >80% test coverage**.",
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
    gm: "AI/LLM: Built a **production LLM chatbot assistant** on GPT via Databricks AI Gateway with Entra ID auth; built an AI test agent in GitHub Actions that writes Playwright E2E tests from Jira acceptance criteria, and Glean agents that automate sprint reporting.",
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
    gm: "Efficiency: Automated AIAG 2D-barcode validation, **saving 2+ days of tester time per regression cycle**; regression baselines cut release verification 35%; ran monthly patch testing for zero-downtime releases.",
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
    gm: "Test automation: Engineered **100+ automated UI tests** in C#/Selenium and wired them into Jenkins CI jobs mapped to TFS test cases, turning manual regression into unattended automated runs.",
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
    gm: "Efficiency: Automated AIAG 2D-barcode validation, saving 2+ days of tester time per regression cycle; **regression baselines cut release verification 35%**; ran monthly patch testing for zero-downtime releases.",
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
    gm: "Efficiency: Automated AIAG 2D-barcode validation, saving 2+ days of tester time per regression cycle; regression baselines cut release verification 35%; **ran monthly patch testing for zero-downtime releases**.",
    twin: "Production deploys only through a pipeline on main. Every migration must only expand the schema, so the live code keeps working while the new build goes out. A probe hits the live site every second through the switch, and a smoke test checks every page after. An uptime probe runs every half hour.",
    exhibit: 8,
    status: "running",
    code: [
      { label: "The deploy job", path: ".github/workflows/ci.yml" },
      { label: "Expand-only migrations", path: "scripts/ci/expand-only.mjs" },
      { label: "The switch and the smoke test", path: "scripts/deploy/ship.mjs" },
      { label: "The uptime probe", path: ".github/workflows/uptime.yml" },
    ],
  },
];

/** Where the shop is served (under its base path on Vercel: next.config.ts). Public; CI posts its
 *  figures to the API here, which also still answers at the root. */
export const SITE = `https://sally-manders-coffee.vercel.app${process.env.NEXT_PUBLIC_SHOP_BASE ?? ""}`;

/** A repository path as its file on GitHub; a path starting with "/" is a page of this site. */
export const codeUrl = (path: string) => (path.startsWith("/") ? `${SITE}${path}` : `https://github.com/${REPO}/blob/main/${path}`);
