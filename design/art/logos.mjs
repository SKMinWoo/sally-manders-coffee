// Photographs the cup art for every theme and name (mockups/logo-sheet.html) as a transparent
// PNG for cup.py to print on its cup, and writes art/out/cups.json (each cup's colours and print).
//   node art/logos.mjs [theme]
// This project has no dependencies of its own yet, so Playwright is borrowed from a sibling
// checkout (PW_FROM, default the portfolio) and drives the Chrome already installed.

import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(process.env.PW_FROM ?? "C:/Users/Alexj/sources/alex-kim-portfolio/package.json");
const { chromium } = require("playwright-core");

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "out");
mkdirSync(out, { recursive: true });
const sheet = pathToFileURL(path.join(here, "..", "mockups", "logo-sheet.html")).href;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
await page.goto(sheet, { waitUntil: "networkidle" });
const { themes, names } = await page.evaluate(() => ({ themes: window.THEME_IDS, names: window.NAME_IDS }));
const cups = [];
for (const t of [...themes, "brand"].filter((id) => !process.argv[2] || id === process.argv[2])) {
  for (const n of names) {
    await page.goto(`${sheet}?t=${t}&n=${n}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready.then(() => window.fit()));
    await page.waitForTimeout(150);
    const id = `${t}-${n}`, print = path.join(out, `print-${id}.png`);
    await page.locator("#art").screenshot({ path: print, omitBackground: true });
    const { body, lid } = await page.evaluate((id) => (window.THEMES[id] ?? window.BRAND).cup, t);
    cups.push({ id, body, lid, print });
  }
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
  console.log(t, "prints:", names.length, "fonts loaded:", [...new Set(fonts)].join(", ") || "none");
}
writeFileSync(path.join(out, "cups.json"), JSON.stringify(cups, null, 2));
await browser.close();
