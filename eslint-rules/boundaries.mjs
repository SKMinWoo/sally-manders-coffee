// The domain boundaries, as a lint rule (docs/decisions/0004-domain-modules.md).
//
// The server is seven modules. Each is a folder under server/ with one public entry, its index.ts,
// and may use only the modules listed for it below, so the dependencies run one way and can't
// form a cycle. Under them is a shared kernel (lib/ and server/platform/) that anything may use
// and that uses no module. Around them are the edges, where the modules meet the outside world:
// the routes and pages, the API's handlers, the scripts and the tests, unit and browser (e2e/).
// An edge may wire any modules together, but only through their public entries.
//
// `check()` is the whole rule as a plain function, so the lint rule, its tests and the CI figures
// on /office all apply exactly the same one.

import path from "node:path";

/** Each module, and the modules it may use. */
export const MODULES = {
  menu: [],
  simulator: ["menu"],
  orders: ["menu", "simulator"],
  reporting: ["menu", "orders"],
  brief: ["reporting"],
  office: ["orders", "reporting", "brief"],
  board: ["menu", "simulator", "reporting", "brief"],
};

/** The shared kernel: anything may use it, and it uses no module. */
const KERNEL = [/^lib\//, /^server\/platform\//];

/**
 * The edges: they may use any module, through its index. The local development database is one
 * because it seeds itself by running the simulator, which is wiring, not platform code.
 */
const EDGES = [/^app\//, /^components\//, /^scripts\//, /^server\/api\//, /\.test\.tsx?$/, /^e2e\//, /^server\/platform\/db\/local\.ts$/];

const SOURCE = /\.(?:tsx?|mjs|js)$/;

/** Where a file sits: in which module (if any), and whether it is an edge or the kernel. */
export function areaOf(file) {
  const m = /^server\/([^/]+)\//.exec(file);
  const mod = m && Object.hasOwn(MODULES, m[1]) ? m[1] : null;
  const edge = EDGES.some((r) => r.test(file));
  const kernel = !edge && KERNEL.some((r) => r.test(file));
  return { module: mod, edge, kernel };
}

/** A file under server/ that belongs to no module, the platform or the API: a folder nobody declared. */
export function undeclared(file) {
  if (!SOURCE.test(file) || areaOf(file).edge) return null;
  const m = /^server\/(?:([^/]+)\/)?/.exec(file);
  if (!m) return null;
  const folder = m[1] ?? "";
  return folder in MODULES || folder === "platform" || folder === "api" ? null : `server/${folder}`;
}

/** The repository path an import names, without its extension; null for packages. */
export function resolve(file, spec) {
  let target;
  if (spec.startsWith("@/")) target = spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../")) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), spec));
  else return null;
  return target.replace(SOURCE, "");
}

/** The module an import lands in, if it lands in one. */
export function moduleOf(target) {
  const m = /^server\/([^/]+)(?:\/|$)/.exec(target ?? "");
  return m && Object.hasOwn(MODULES, m[1]) ? m[1] : null;
}

/**
 * What an import of `spec` from `file` (both relative to the repository root, with forward
 * slashes) breaks: null when it's fine, or the kind of breach and the words for the message.
 */
export function check(file, spec) {
  const target = resolve(file, spec);
  if (target === null) return null;
  const from = areaOf(file);
  const to = moduleOf(target);

  if (to) {
    if (to === from.module) return null; // inside one module, anything goes
    const inside = target.slice(`server/${to}`.length).replace(/^\//, "");
    if (inside !== "" && inside !== "index") return { kind: "deep", data: { target, to } };
    if (from.kernel) return { kind: "kernel", data: { file, to } };
    if (from.module && !from.edge && !MODULES[from.module].includes(to)) {
      return { kind: "direction", data: { from: from.module, to, allowed: MODULES[from.module].join(", ") || "none" } };
    }
    return null;
  }
  // nothing but an edge may lean on an edge: modules and the kernel never import routes, pages or the API
  if (!from.edge && /^(?:app|components|scripts|server\/api)(?:\/|$)/.test(target)) return { kind: "edge", data: { target } };
  return null;
}

const rule = {
  meta: {
    type: "problem",
    docs: { description: "Keep server/ modules behind their public entries, and their dependencies one way" },
    schema: [],
    messages: {
      deep: '{{target}} is inside the {{to}} module. Import it from "@/server/{{to}}", the module\'s public entry.',
      direction: "The {{from}} module may not use {{to}}; it may use: {{allowed}}. See docs/decisions/0004-domain-modules.md.",
      kernel: "{{file}} is shared platform code, which no module depends on, so it may not use the {{to}} module.",
      edge: "Only the edges (app/, components/, scripts/, server/api/ and tests) may import {{target}}.",
      undeclared: "{{folder}}/ is not a declared module, the platform or the API. Add it to MODULES in eslint-rules/boundaries.mjs.",
    },
  },
  create(context) {
    const file = path.relative(context.cwd, context.filename).split(path.sep).join("/");
    if (file.startsWith("..")) return {};
    const report = (node, spec) => {
      const breach = check(file, spec);
      if (breach) context.report({ node, messageId: breach.kind, data: breach.data });
    };
    const fromSource = (node) => {
      if (typeof node.source?.value === "string") report(node.source, node.source.value);
    };
    return {
      Program(node) {
        const folder = undeclared(file);
        if (folder) context.report({ node, messageId: "undeclared", data: { folder } });
      },
      ImportDeclaration: fromSource,
      ExportNamedDeclaration: fromSource,
      ExportAllDeclaration: fromSource,
      ImportExpression(node) {
        if (node.source.type === "Literal" && typeof node.source.value === "string") report(node.source, node.source.value);
      },
    };
  },
};

const plugin = { meta: { name: "sally" }, rules: { boundaries: rule } };
export default plugin;
