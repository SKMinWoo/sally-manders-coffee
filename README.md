# Sally Mander's

A coffee shop in South Austin that never closes, because it does not exist. Sally Mander's is a
**simulated business**: a storefront you can order from, a back office with the day's numbers, and
a simulator that keeps the counter busy around the clock.

It was built by its developer to show, on a running system, the kind of work their résumé
describes: each claim gets a small working twin here that you can click, read or run.

## What is here

| Path | What it is |
| --- | --- |
| `design/mockups/` | The five theme mockups the look was picked from (the sign painter won), the logo sheet, and Sally's entrance animation |
| `design/art/` | The Blender script that renders the to-go cup |
| `design/sim/` | The first, aggregate-only simulator the mockups were filled from |

The application is Next.js (App Router) and TypeScript on Vercel, with Postgres on Neon through
Drizzle, and zod at every boundary. Decisions worth explaining are written down in
[`docs/decisions/`](docs/decisions/).

## Working on it

Node 24 or later.

```bash
npm ci
npm run dev      # http://localhost:3000
npm run check    # typecheck, lint, tests
```

Dependencies are pinned to exact versions and installed with scripts disabled (`.npmrc`), and CI
verifies their registry signatures on every run.

## Viewing the mockups

They load sibling scripts, so serve the folder rather than opening a file:

```bash
python -m http.server 5178 --bind 127.0.0.1 --directory design/mockups
```

Then open http://localhost:5178/.
