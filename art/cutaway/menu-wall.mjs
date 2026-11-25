// The menu wall's painted face (toy.py hangs it behind the counter), lettered in the shop's own faces
// (Big Shoulders, Barlow Condensed, Yellowtail, as next/font self-hosts them under .next, so run the
// dev server once first) from the real catalogue, and photographed by Playwright's Edge.
//
//     node art/cutaway/menu-wall.mjs [out.png]      (default: art/cutaway/menu-wall.png)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const OUT_PNG = process.argv[2] || path.join(HERE, "menu-wall.png");

// the catalogue, read as text so no TS loader is needed
const src = fs.readFileSync(REPO + "/server/menu/catalog.ts", "utf8");
const items = [...src.matchAll(/\{ id: "([^"]+)", name: "([^"]+)", group: "([^"]+)", priceCents: (\d+)/g)]
  .map(([, id, name, group, c]) => ({ id, name, group, price: (Number(c) / 100).toFixed(2) }));
const groups = [...src.matchAll(/\{ id: "([^"]+)", title: "([^"]+)" \}/g)].map(([, id, title]) => ({ id, title }));
const HOUSE = /HOUSE_ID = "([^"]+)"/.exec(src)[1];
if (items.length !== 13 || groups.length !== 4) throw new Error(`catalogue parse: ${items.length} items, ${groups.length} groups`);

// the latin subset of each face
const chunks = path.join(REPO, ".next/dev/static/chunks");
const fonts = {};
for (const f of fs.readdirSync(chunks).filter((f) => f.includes("font_google") && f.endsWith(".css"))) {
  const css = fs.readFileSync(path.join(chunks, f), "utf8");
  for (const m of css.matchAll(/@font-face\s*\{([^}]+)\}/g)) {
    const b = m[1];
    // the latin block: U+0000-00FF, which Turbopack writes as U+??
    if (!/unicode-range:\s*U\+(\?\?|0000-00FF)/.test(b)) continue;
    const fam = /font-family:\s*['"]?([^;'"]+)/.exec(b)[1].trim();
    const weight = /font-weight:\s*([^;]+)/.exec(b)[1].trim();
    const url = /url\(([^)]+)\)/.exec(b)[1].replace(/['"]/g, "");
    const local = path.join(REPO, ".next/dev/static/media", path.basename(url));
    if (!fs.existsSync(local)) continue;
    // inlined: a page set from a string can't fetch file:// fonts
    (fonts[fam] ||= []).push({ weight, url: "data:font/woff2;base64," + fs.readFileSync(local).toString("base64") });
  }
}
const need = ["Big Shoulders", "Barlow Condensed", "Yellowtail"];
for (const n of need) if (!fonts[n]) throw new Error("font not found: " + n + " (have " + Object.keys(fonts) + ")");

// the board face in room.py is 6.44 m by 1.38 m
const W = 3000, H = Math.round(3000 * 1.38 / 6.44);
const grp = (g) => {
  const rows = items.filter((i) => i.group === g.id).map((i) => `
    <li class="${i.id === HOUSE ? "house" : ""}"><span class="n">${i.name}</span><i></i><span class="p">${i.price}</span></li>`).join("");
  return `<h2>${g.title}</h2><ul>${rows}</ul>`;
};
// three columns of about five rows: the two short sections share the middle one
const [bar, brewed, notCoffee, food] = groups;
const cols = [[bar], [brewed, notCoffee], [food]];
const col = (gs) => `<section>${gs.map(grp).join("")}</section>`;
const html = `<!doctype html><meta charset="utf-8"><style>
${[["Block", "Big Shoulders"], ["Cond", "Barlow Condensed"], ["Script", "Yellowtail"]]
  .flatMap(([as, fam]) => fonts[fam].map((f) => `@font-face { font-family: ${as}; src: url("${f.url}"); font-weight: ${f.weight}; }`)).join("\n")}
html, body { margin: 0; }
body { width: ${W}px; height: ${H}px; background: #2B2119; color: #F1E6CF; overflow: hidden; position: relative; }
/* warm painted board: a soft lamp-wash from above, and a hand-cut keyline in mustard */
body::before { content: ""; position: absolute; inset: 0;
  background: radial-gradient(120% 90% at 50% -10%, rgba(255, 214, 160, .14), rgba(0, 0, 0, 0) 60%),
              linear-gradient(180deg, rgba(0, 0, 0, 0) 70%, rgba(0, 0, 0, .18)); }
.key { position: absolute; inset: 26px; border: 5px solid #D9A136; border-radius: 10px; }
header { position: absolute; left: 0; right: 0; top: 34px; text-align: center; }
header b { font: 400 112px/1 Script; color: #E7533F; letter-spacing: .01em; text-shadow: 0 3px 0 #7A2318; }
header small { display: block; margin-top: 0; font: 700 26px/1 Cond; letter-spacing: .5em; color: #D9A136; text-transform: uppercase; }
main { position: absolute; left: 110px; right: 110px; top: 214px; bottom: 50px; display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 130px; }
h2 { margin: 0 0 8px; padding-bottom: 8px; border-bottom: 5px solid #D9A136; font: 800 46px/1 Block; letter-spacing: .05em; text-transform: uppercase; color: #D9A136; }
ul + h2 { margin-top: 18px; }
ul { list-style: none; margin: 0; padding: 0; }
li { display: flex; align-items: baseline; gap: 12px; font: 600 40px/1.3 Cond; letter-spacing: .03em; text-transform: uppercase; }
li i { flex: 1; border-bottom: 4px dotted rgba(241, 230, 207, .45); transform: translateY(-10px); }
li .p { font: 800 44px/1 Block; color: #F1E6CF; font-variant-numeric: tabular-nums; }
li.house .n { font: 400 46px/1 Script; text-transform: none; letter-spacing: 0; color: #E7533F; }
</style>
<div class="key"></div>
<header><b>Sally Mander's</b><small>Coffee · Kolaches · Tacos</small></header>
<main>${cols.map(col).join("")}</main>`;

(async () => {
  const b = await chromium.launch({ channel: "msedge" });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  const loaded = await p.evaluate(() => [...document.fonts].map((f) => `${f.family}:${f.status}`));
  await p.screenshot({ path: OUT_PNG });
  await b.close();
  console.log("ok", loaded.join(" "));
})();
