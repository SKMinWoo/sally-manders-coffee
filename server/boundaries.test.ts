import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve as resolvePath } from "node:path";
import { Linter } from "eslint";
import boundaries, { check, MODULES, undeclared } from "@/eslint-rules/boundaries.mjs";

test("the modules' allowed uses run one way: no module can reach itself", () => {
  const reaches = (from: string, seen = new Set<string>()): Set<string> => {
    for (const to of MODULES[from] ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      reaches(to, seen);
    }
    return seen;
  };
  for (const m of Object.keys(MODULES)) {
    assert.ok(!reaches(m).has(m), `${m} can reach itself`);
    for (const to of MODULES[m]!) assert.ok(to in MODULES, `${m} lists ${to}, which isn't a module`);
  }
});

test("every kind of breach is caught", () => {
  const kind = (file: string, spec: string) => check(file, spec)?.kind ?? "ok";
  // into another module's insides, by alias or by a relative path that climbs out
  assert.equal(kind("server/reporting/metrics.ts", "@/server/orders/repository"), "deep");
  assert.equal(kind("server/reporting/metrics.ts", "../orders/repository"), "deep");
  assert.equal(kind("app/page.tsx", "@/server/menu/catalog"), "deep", "an edge still goes through the index");
  assert.equal(kind("server/simulator/run.test.ts", "@/server/orders/repository"), "deep", "so does a test");
  // against the direction
  assert.equal(kind("server/menu/repository.ts", "@/server/orders"), "direction");
  assert.equal(kind("server/simulator/run.ts", "@/server/reporting"), "direction");
  // the kernel leaning on a module, and anything but an edge leaning on an edge
  assert.equal(kind("server/platform/http.ts", "@/server/office"), "kernel");
  assert.equal(kind("lib/time.ts", "@/server/menu"), "kernel");
  assert.equal(kind("server/office/ingest.ts", "@/server/api/v1"), "edge");
  assert.equal(kind("server/orders/place.ts", "@/app/order/cart"), "edge");
  // a folder nobody declared
  assert.equal(undeclared("server/inventory/stock.ts"), "server/inventory");
  assert.equal(undeclared("server/helpers.ts"), "server/");
});

test("and what the boundaries allow is left alone", () => {
  for (const [file, spec] of [
    ["server/reporting/export/sales.ts", "../sales"], // inside one module
    ["server/reporting/metrics.ts", "@/server/orders"], // an allowed use, through the index
    ["server/office/engineering.ts", "@/server/reporting/index"],
    ["server/orders/wait.ts", "@/server/platform/db/client"], // the kernel, from anywhere
    ["server/menu/catalog.ts", "@/lib/money"],
    ["server/api/v1.ts", "@/server/office"], // an edge may use any module
    ["server/orders/place.test.ts", "./repository"], // a test inside its own module
    ["server/platform/db/local.ts", "@/server/simulator"], // the dev database seeds itself
    ["server/orders/place.ts", "drizzle-orm"], // a package
  ] as const) {
    assert.equal(check(file, spec), null, `${file} -> ${spec}`);
  }
  assert.equal(undeclared("server/every-module.test.ts"), null);
  assert.equal(undeclared("server/office/index.ts"), null);
});

test("as a lint rule, it reports through ESLint itself", () => {
  const linter = new Linter();
  const config = [{ files: ["**/*.ts"], plugins: { sally: boundaries }, rules: { "sally/boundaries": "error" as const } }];
  const lint = (file: string, code: string) =>
    linter.verify(code, config, { filename: resolvePath(file) }).map((m) => `${m.ruleId}: ${m.message}`);

  const [deep, ...rest] = lint(
    "server/reporting/metrics.ts",
    'import { placedBy } from "@/server/orders/repository";\nexport { x } from "../office/claims";\nconst lazy = () => import("@/server/office");\nexport default lazy;',
  );
  assert.equal(deep, 'sally/boundaries: server/orders/repository is inside the orders module. Import it from "@/server/orders", the module\'s public entry.');
  assert.equal(rest.length, 2, "re-exports and dynamic imports are checked too");
  assert.match(rest[1]!, /The reporting module may not use office; it may use: menu, orders/);
  assert.deepEqual(lint("server/reporting/metrics.ts", 'import { placedBy } from "@/server/orders";\nexport default placedBy;'), []);
  assert.match(lint("server/inventory/stock.ts", "export const n = 1;")[0]!, /server\/inventory\/ is not a declared module/);
});
