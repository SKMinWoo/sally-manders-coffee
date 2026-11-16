# 4. The server is five domain modules, each used through one public entry

Date: 2026-11-15 · Status: accepted, amended by [0005](0005-the-brief-and-its-guard.md) (a sixth module, `brief`)

## Context

The server grew by layer: `server/db/repositories/` held every query, `server/shop/` the ordering
rules, `server/sim/` the simulator and `server/export/` the workbook. Any file could import any
other, and some did. The orders repository wrote simulated days, the simulator reached into the
orders repository, and a page of the storefront imported the menu's database code just to get a
list of headings, which put a database driver in the browser's bundle.

Nothing was broken yet, but nothing stopped it either. A change to how orders are stored meant
reading every importer to find out what depended on it.

## Decision

`server/` is split by domain into five modules, each a folder with one public entry, its
`index.ts`:

| Module | Owns | May use |
|---|---|---|
| `menu` | the catalogue and the menu table | nothing |
| `simulator` | generating days and writing them | menu |
| `orders` | placing and reading orders, the storefront's view | menu, simulator |
| `reporting` | daily figures, Behind the scenes, the sales export | menu, orders |
| `office` | the résumé claims and the figures CI posts | orders, reporting |

Under them is a shared kernel that anything may use and that uses no module: `lib/` (time, money,
ids) and `server/platform/` (the database client and schema, HTTP results, bearer-token checks).
Around them are the edges: the routes and pages in `app/`, the components, the scripts, the API's
handlers in `server/api/` and the tests. An edge may wire any modules together, but only through
their public entries. The local development database is an edge too, because it seeds itself by
running the simulator.

Inside a module, files import each other by relative path. From outside, a module is imported as
`@/server/<module>` and nothing deeper.

`eslint-rules/boundaries.mjs` enforces all of it as a lint rule that fails the build: an import
that reaches inside another module, one against the direction in the table, the kernel importing a
module, a module importing an edge, or a folder under `server/` that isn't declared. CI runs the
rule's own check over every import in the repository and posts the count to /office.

## Consequences

- The table is the dependency graph, and it has no cycles, which a test checks. Adding a use is a
  one-line change to the rule, made on purpose and visible in review.
- A module can change anything behind its index without reading its importers. The orders tables
  are still shared with the simulator, which writes its own rows; the simulator's writes moved
  into the simulator module so that only one module writes a simulated day.
- Client components can't import a module's index without pulling its database code into the
  bundle, so they take what they need as props from the server page that renders them.
- This is one Next.js app with one database, not a set of services. The modules could become
  services later (each index is the shape its API would take), but nothing here pays the cost of a
  network between them, and the résumé's microservices are GM's, not the shop's.
