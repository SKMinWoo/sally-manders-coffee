// Shared by the five theme mockups. It does the parts that are the same everywhere, so each page
// is only its own layout and CSS:
//   the mockup bar, the Storefront / Behind the scenes switch,
//   the simulated day's numbers (data-day), the menu (data-menu), the hour chart (data-hours),
//   the best sellers (data-top), the name, mascot, wordmark and cup, and the brand kit.
// The shop is Sally Mander's on every page; a theme only dresses it. Open a page with ?view=back
// to land on Behind the scenes.
{
  const D = window.DAY, root = document.documentElement;
  const T = THEMES[root.dataset.theme];
  const q = new URLSearchParams(location.search);
  const all = (sel, fn) => document.querySelectorAll(sel).forEach(fn);

  const mmss = (s) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  const clock = (h) => `${((h + 11) % 12) + 1}${h < 12 ? " am" : " pm"}`;
  const money = (n, digits = 0) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const date = new Date(D.date + "T12:00:00Z");
  const fmt = (o) => date.toLocaleDateString("en-US", { timeZone: "UTC", ...o });
  const morning = D.hours.filter((h) => h.hour < 10).reduce((s, h) => s + h.orders, 0);
  const values = {
    orders: D.orders, cups: D.cups, items: D.items,
    revenue: money(Math.round(D.revenue)), avgTicket: money(D.avgTicket, 2),
    waitP50: mmss(D.waitP50), waitP95: mmss(D.waitP95),
    top: D.top.name, topSold: D.top.sold,
    peakHour: `${clock(D.peak.hour).replace(/ [ap]m/, "")}–${clock(D.peak.hour + 1)}`, peakOrders: D.peak.orders,
    morningShare: Math.round((100 * morning) / D.orders) + "%",
    ticketNo: String(D.orders + 1).padStart(4, "0"),
    date: fmt({ weekday: "long", month: "long", day: "numeric" }),
    dateShort: fmt({ weekday: "short", day: "numeric", month: "short" }),
  };
  all("[data-day]", (el) => (el.textContent = values[el.dataset.day]));

  const peakOrders = Math.max(...D.hours.map((h) => h.orders));
  all("[data-hours]", (ol) => {
    ol.innerHTML = D.hours.map((h) =>
      `<li style="--v:${(h.orders / peakOrders).toFixed(3)}"${h.orders === peakOrders ? ' class="peak"' : ""}><b>${h.orders}</b><i></i><span>${clock(h.hour).replace(" ", "")}</span></li>`).join("");
  });

  const maxSold = Math.max(...Object.values(D.sold));
  function menus(n) {
    const label = (m) => (m.id === "house" ? n.house[0] : m.name);
    all("[data-menu]", (ul) => {
      ul.innerHTML = D.menu.filter((m) => m.group === ul.dataset.menu).map((m) =>
        `<li data-id="${m.id}"${m.id === "house" ? ' class="house"' : ""} style="--s:${(D.sold[m.id] / maxSold).toFixed(3)}"><b>${label(m)}</b>${m.id === "house" ? `<small>${n.house[1]}</small>` : ""}<i></i><span>${m.price.toFixed(2)}</span><em>${D.sold[m.id]}</em></li>`).join("");
    });
    all("[data-top]", (ol) => {
      ol.innerHTML = [...D.menu].sort((a, b) => D.sold[b.id] - D.sold[a.id]).slice(0, +ol.dataset.top || 5).map((m) =>
        `<li style="--v:${(D.sold[m.id] / maxSold).toFixed(3)}"><b>${label(m)}</b><i></i><span>${D.sold[m.id]}</span></li>`).join("");
    });
  }

  function setName(id) {
    const n = NAMES[id] ?? NAMES.sally;
    root.dataset.name = n.id;
    document.title = `${n.name} · ${T.title} (mockup)`;
    all("body [data-name]", (el) => (el.textContent = n.name)); // not <html>, which carries data-name too
    all("[data-line]", (el) => (el.textContent = n.line));
    all("[data-local]", (el) => (el.textContent = n.local));
    all("[data-house]", (el) => (el.textContent = n.house[0]));
    all("[data-house-note]", (el) => (el.textContent = n.house[1]));
    all("[data-wm]", (el) => {
      el.style.cssText += ";" + T.wm;
      el.innerHTML = n.word(el.dataset.wm === "stack");
    });
    all("[data-mascot]", (el) => (el.innerHTML = n.mascot(T.pal[el.dataset.mascot || "paper"])));
    all("img[data-cup]", (el) => { el.src = `assets/cup-${T.id}-${n.id}.png`; el.alt = `A to-go cup printed with the ${n.name} mascot`; });
    menus(n);
    kit(n);
  }
  function setView(v) {
    root.dataset.view = v === "back" ? "back" : "front";
    all("[data-go]", (b) => b.setAttribute("aria-pressed", b.dataset.go === root.dataset.view));
  }

  function kit(n) {
    const el = document.getElementById("kit");
    if (!el) return;
    const tile = (pal, mark) => `<div class="kit-tile${mark ? " kit-mark" : ""}" style="background:${pal.bg};color:${pal.ink}">
      <span class="kit-m">${n.mascot(pal)}</span>${mark ? "" : `<span class="kit-w" style="${T.wm};--drop:${pal.accent}">${n.word(false)}</span>`}</div>`;
    el.innerHTML = `
      <p class="kit-h">Brand kit · theme ${T.n} of 05 · ${T.title}</p>
      <div class="kit-tiles">${tile(T.pal.paper)}${tile(T.pal.dark)}${tile(T.pal.pop, true)}</div>
      <div class="kit-row">
        <ul class="kit-chips">${T.colors.map(([name, hex]) => `<li><i style="background:${hex}"></i><b>${name}</b><span>${hex}</span></li>`).join("")}</ul>
        <ul class="kit-type">${T.type.map(([name, fam, w]) => `<li style="font-family:${fam};font-weight:${w}"><span>${name}</span>Two shots, one kolache, 0123</li>`).join("")}</ul>
      </div>`;
  }

  // The mockup bar is a control for choosing, not part of the shop's design.
  const bar = document.createElement("div");
  bar.id = "mock";
  bar.innerHTML = `<a href="index.html">All five themes</a><b>Mockup ${T.n} / 05 · ${T.title}</b>
    <span class="mock-names"><a href="logo.html">Sally Mander's logo sheet</a></span>`;
  document.body.prepend(bar);
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-go]"); if (b) { setView(b.dataset.go); window.scrollTo(0, 0); } });

  window.SHOP = { day: D, values, theme: T, mmss, clock, money, setName, setView };
  setName(q.get("name") ?? "sally");
  setView(q.get("view"));
}
