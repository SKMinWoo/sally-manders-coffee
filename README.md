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

The application itself arrives through the pull requests that follow this commit.

## Viewing the mockups

They load sibling scripts, so serve the folder rather than opening a file:

```bash
python -m http.server 5178 --bind 127.0.0.1 --directory design/mockups
```

Then open http://localhost:5178/.
