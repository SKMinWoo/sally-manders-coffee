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
    twin: "“Export sales” on Behind the scenes: a streamed workbook of every order line over a chosen span, and a repeat request with nothing new answered “Nothing changed”.",
    exhibit: 4,
    status: "coming",
    code: [],
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
    twin: "Orders, menu, reporting and the simulator as modules with one public entry each, the boundaries enforced by a lint rule, and each of the twelve factors pointed at its evidence.",
    exhibit: 10,
    status: "coming",
    code: [],
  },
  {
    id: "devsecops",
    role: FS,
    gm: "Built DevSecOps pipelines across GitHub Actions and Azure DevOps with SonarQube, CodeQL, Dependabot and Wiz — gating on vulnerabilities and holding **80%+ test coverage**.",
    twin: "CodeQL, Dependabot and a SonarCloud scan on every pull request, and a coverage gate that fails the build below its threshold.",
    exhibit: 2,
    status: "coming",
    code: [],
  },
  {
    id: "ai-adoption",
    role: FS,
    gm: "Led cross-functional **AI developer adoption**: custom Glean agents, GitHub Actions and an Azure-hosted AI agent API that cut developer toil, streamlined sprint updates and automated test-gap remediation.",
    twin: "A daily manager’s brief written by a model and checked by a guard that rejects any number not in the day’s figures, and an Action that names a pull request’s untested lines.",
    exhibit: 9,
    status: "coming",
    code: [],
  },
  {
    id: "barcode",
    role: SDET,
    gm: "Led the architecture and rollout of an automated barcode verification framework, saving **2+ days of manual testing every regression cycle**.",
    twin: "Every guest check prints a Code 128 barcode of its ticket, and a suite renders, screenshots and decodes each one from the pixels.",
    exhibit: 5,
    status: "coming",
    code: [],
  },
  {
    id: "ui-tests",
    role: SDET,
    gm: "Built and scaled **100+ Selenium UI tests** and **300+ end-to-end integration and API tests** running in Azure DevOps CI/CD.",
    twin: "A Playwright suite through the order flow, the countdown, the docs and phone widths, beside the API contract tests, all run on every pull request.",
    exhibit: 3,
    status: "coming",
    code: [],
  },
  {
    id: "quality-gates",
    role: SDET,
    gm: "Set up automated quality gates and regression baselines that made release verification **35% faster** across core manufacturing platforms.",
    twin: "Screenshot baselines of every page at two widths, and a release gate that has to pass before production deploys.",
    exhibit: 6,
    status: "coming",
    code: [],
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
export const codeUrl = (path: string) => `https://github.com/${REPO}/blob/main/${path}`;
