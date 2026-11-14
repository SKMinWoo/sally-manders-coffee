// Simulates one day at the counter and writes it where the mockups can read it.
//   node sim/sample-day.mjs [YYYY-MM-DD]
// The same date always gives the same day: the generator is seeded from it.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MENU, OPEN, CLOSE } from "./menu.mjs";
import { demandAt } from "./demand.mjs";

const date = process.argv[2] ?? "2026-11-13";
const weekday = new Date(date + "T12:00:00Z").getUTCDay();

// mulberry32: small, fast, and good enough for a pretend till
let seed = [...date].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 0x9e3779b9);
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const poisson = (mean) => {
  let k = 0;
  for (let p = Math.exp(-mean), s = p, u = rand(); u > s; s += p) p *= mean / ++k;
  return k;
};
const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
const pick = (daypart) => {
  let at = rand() * MENU.reduce((s, m) => s + m.w[daypart], 0);
  return MENU.find((m) => (at -= m.w[daypart]) < 0);
};

const BARISTAS_PER_HOUR = 38; // orders two people on bar clear comfortably
const hours = [];
const sold = Object.fromEntries(MENU.map((m) => [m.id, 0]));
const waits = [];
let orders = 0, items = 0, revenue = 0;

for (let hour = OPEN; hour < CLOSE; hour++) {
  const n = poisson(demandAt({ hour, weekday }));
  const daypart = hour < 10 ? 0 : hour < 14 ? 1 : 2;
  const load = n / BARISTAS_PER_HOUR; // above 1 the queue backs up
  let cups = 0;
  for (let i = 0; i < n; i++) {
    const size = rand() < 0.62 ? 1 : rand() < 0.75 ? 2 : 3;
    for (let j = 0; j < size; j++) {
      const item = pick(daypart);
      sold[item.id]++;
      revenue += item.price;
      if (item.group !== "food") cups++;
    }
    items += size;
    // seconds from paying to the cup on the counter
    waits.push((80 + 34 * size + 150 * Math.max(0, load - 0.55) ** 1.5) * Math.exp(0.3 * gauss()));
  }
  orders += n;
  hours.push({ hour, orders: n, cups });
}

waits.sort((a, b) => a - b);
const q = (p) => Math.round(waits[Math.floor(p * (waits.length - 1))]);
const top = MENU.filter((m) => m.group !== "food").sort((a, b) => sold[b.id] - sold[a.id])[0];
const peak = hours.reduce((a, b) => (b.orders > a.orders ? b : a));

const day = {
  date, weekday, orders, items,
  cups: hours.reduce((s, h) => s + h.cups, 0),
  revenue: Math.round(revenue * 100) / 100,
  avgTicket: Math.round((revenue / orders) * 100) / 100,
  waitP50: q(0.5), waitP95: q(0.95),
  top: { id: top.id, name: top.name, sold: sold[top.id] },
  peak, hours, sold,
  menu: MENU.map(({ id, name, group, price }) => ({ id, name, group, price })),
};

const out = fileURLToPath(new URL("../mockups/day.js", import.meta.url));
writeFileSync(out, `// written by sim/sample-day.mjs; do not edit\nwindow.DAY = ${JSON.stringify(day)};\n`);
console.log(`${date}: ${orders} orders, ${day.cups} cups, $${day.revenue}, avg $${day.avgTicket}, ` +
  `wait p50 ${day.waitP50}s p95 ${day.waitP95}s, peak ${peak.hour}:00 (${peak.orders}), top ${top.name} ×${sold[top.id]}`);
