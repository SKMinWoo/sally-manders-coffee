// The five shortlisted names. Each has one mascot, drawn here once as SVG with four colour slots
// (ink, fill, accent, paper) so every theme can print it in its own inks. Names and themes are
// independent: any page can wear any name.
{
  const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img">${body}</svg>`;

  /* A great-tailed grackle, head thrown back, telling the car park about it. */
  const grackle = (p) => svg(`
    <path fill="${p.ink}" d="M78 114 20 174l13 15 62-52Z"/>
    <path fill="${p.ink}" d="M112 102 121 64l28 18-11 32Z"/>
    <ellipse fill="${p.ink}" cx="104" cy="118" rx="41" ry="27" transform="rotate(-28 104 118)"/>
    <circle fill="${p.ink}" cx="132" cy="76" r="18"/>
    <path fill="${p.ink}" d="M122 66 131 16l10 46Z"/>
    <path fill="${p.ink}" d="M138 66 168 34l-19 43Z"/>
    <path fill="${p.fill}" d="M80 114q27-22 52-3-21 23-55 20Z"/>
    <circle fill="${p.accent}" cx="134" cy="79" r="6"/><circle fill="${p.ink}" cx="135" cy="78" r="2.4"/>
    <g fill="none" stroke="${p.ink}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M100 142 96 176m-10 5 10-5 10 5"/><path d="M117 139l2 37m-10 5 10-5 10 5"/></g>
    <g fill="none" stroke="${p.accent}" stroke-width="5.5" stroke-linecap="round">
      <path d="M149 16l4-11"/><path d="M165 20l10-9"/><path d="M176 34l13-3"/></g>`);

  /* A Mexican free-tailed bat, wrapped in its own wings, asleep on the rim through the day shift. */
  const zed = (x, y, s, c) => `<path fill="none" stroke="${c}" stroke-width="${4 / s}" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x} ${y}) scale(${s})" d="M0 0h12L0 14h12"/>`;
  const bat = (p) => svg(`
    <rect fill="${p.accent}" x="36" y="28" width="128" height="11" rx="5.500"/>
    <circle fill="${p.ink}" cx="91" cy="31" r="6"/><circle fill="${p.ink}" cx="109" cy="31" r="6"/>
    <path fill="${p.ink}" d="M100 32C66 48 54 96 68 132c8 20 56 20 64 0 14-36 2-84-32-100Z"/>
    <path fill="none" stroke="${p.fill}" stroke-width="3" stroke-linecap="round" d="M101 44c-10 34-6 66 12 92"/>
    <path fill="${p.fill}" d="M82 158 72 192l28-24ZM118 158l10 34-28-24Z"/>
    <path fill="${p.accent}" d="M82 166l-5 17 13-12ZM118 166l5 17-13-12Z"/>
    <circle fill="${p.fill}" cx="100" cy="146" r="25"/>
    <g fill="none" stroke="${p.ink}" stroke-width="3.2" stroke-linecap="round"><path d="M84 143q6.500 6.500 13 0"/><path d="M103 143q6.500 6.500 13 0"/></g>
    <ellipse fill="${p.ink}" cx="100" cy="156" rx="3.4" ry="2.4"/>
    ${zed(146, 104, 1, p.accent)}${zed(160, 76, 1.4, p.accent)}${zed(150, 46, 0.7, p.accent)}`);

  /* Red-eared sliders, stacked the way they stack on the logs of Lady Bird Lake. */
  const slider = (cx, base, w, p) => {
    const r = w / 2, h = w * 0.36;
    return `
      <path fill="${p.ink}" d="M${cx - r + 2} ${base - 2}l-13 5 13 3Z"/>
      <rect fill="${p.ink}" x="${cx - w * 0.33}" y="${base}" width="${w * 0.17}" height="${w * 0.1}" rx="${w * 0.04}"/>
      <rect fill="${p.ink}" x="${cx + w * 0.16}" y="${base}" width="${w * 0.17}" height="${w * 0.1}" rx="${w * 0.04}"/>
      <ellipse fill="${p.ink}" cx="${cx + r + w * 0.1}" cy="${base - w * 0.09}" rx="${w * 0.15}" ry="${w * 0.105}"/>
      <ellipse fill="${p.accent}" cx="${cx + r + w * 0.06}" cy="${base - w * 0.1}" rx="${w * 0.055}" ry="${w * 0.03}"/>
      <circle fill="${p.paper}" cx="${cx + r + w * 0.16}" cy="${base - w * 0.12}" r="${w * 0.022}"/>
      <path fill="${p.fill}" d="M${cx - r} ${base}A${r} ${h} 0 0 1 ${cx + r} ${base}Z"/>
      <path fill="none" stroke="${p.paper}" stroke-width="${w * 0.028}" stroke-linecap="round" d="M${cx - r * 0.56} ${base - 5}A${r * 0.56} ${h * 0.56} 0 0 1 ${cx + r * 0.56} ${base - 5}M${cx} ${base - h * 0.56 - 5}V${base - h + 4}M${cx - r * 0.42} ${base - h * 0.44}l${-r * 0.2} ${-h * 0.2}M${cx + r * 0.42} ${base - h * 0.44}l${r * 0.2} ${-h * 0.2}"/>
      <rect fill="${p.ink}" x="${cx - r - 4}" y="${base - 4}" width="${w + 8}" height="8" rx="4"/>`;
  };
  const turtle = (p) => svg(slider(94, 164, 116, p) + slider(101, 115, 88, p) + slider(95, 77, 62, p));

  /* Sally: a Barton Springs salamander (Eurycea sosorum), drawn in profile so she reads as that
     animal and not an axolotl: a long, flat head with a blunt snout, a small eye, three thin
     feathered red gills, a slender body freckled with cream, slender toes, and a long tail. Her
     body is down in the striped diner mug she lives in (drawn flat, straight on, with no coffee
     showing), the tip of her tail curls up out of it behind her, and she
     faces right, toward her name in the lockup. No shine dots, no blush.
       head: true              her head on a short length of rim, for sizes below about 48 px
       head: true, tiny: true  the 16 to 32 px cut: thicker gills, a larger eye, no freckles
     Palette slots beyond ink/fill/accent/paper (all optional): spot (freckles), iris (the gold
     ring round her eye), eye (the pupil), line (her mouth). A palette with mono: true prints her in one ink: every
     shape that sits on another is first printed a little larger in the paper colour, leaving a
     clean gap line, and the freckles, eye ring and mouth are knocked out. */
  // one gill: a thin stalk feathered on both sides, pointing along +x before it is turned
  const gill = (x, y, turn, len, w, col) => {
    const f = [0.3, 0.54, 0.78].map((t) => `M${(len * t).toFixed(1)} ${(-2.6 * t).toFixed(1)}l${(len * 0.15).toFixed(1)}-${(len * 0.15).toFixed(1)}M${(len * t + 1.5).toFixed(1)} ${(-2.6 * t).toFixed(1)}l${(len * 0.13).toFixed(1)} ${(len * 0.11).toFixed(1)}`).join("");
    return `<path transform="translate(${x} ${y}) rotate(${turn})" fill="none" stroke="${col}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${w}" d="M0 0C${len * 0.35} -1 ${len * 0.7} -3 ${len} -1${f}"/>`;
  };
  const SALLY_HEAD = "M78 124V116C75 97 86 84 104 82C122 79 144 80 158 85.5C169 89 174.5 94.5 174.5 100.5C174.5 106.5 166.5 109.5 154 109.5H104V124Z";
  const SALLY_BUST = "M80 105C78 94 87 84 104 82C122 79 144 80 158 85.5C169 89 174.5 94.5 174.5 100.5C174.5 106.5 166.5 109.5 154 109.5H95C87 109 81 108 80 105Z";
  const SALLY_TAIL = "M53 122V96C53 90 49 86 43.5 86C37.5 86 33.5 90 33.5 95C33.5 98 35 100.2 37.2 100.6C37.6 98.4 38.2 96 39.8 94.6C41 93.6 42.4 93.2 43.6 93.6C44.8 94 45 95.5 45 97V122Z";
  const FRECKLES = [[112, 89, 1.7], [125, 85, 1.3], [134, 93.5, 1.6], [117, 98.5, 1.3], [161, 99, 1.3]];
  const TAIL_FRECKLES = [[49, 105, 1.3], [49, 93.5, 1.1]];
  const dots = (list, col) => list.map(([x, y, r]) => `<circle fill="${col}" cx="${x}" cy="${y}" r="${r}"/>`).join("");
  const sallyFace = (p, cut) => {
    const tiny = cut === "tiny", mono = p.mono;
    const spot = mono ? p.paper : p.spot ?? p.paper;
    const iris = mono ? p.paper : p.iris ?? "#E8AF4F";
    const line = mono ? p.paper : p.line ?? "#673F4F";
    const pupil = mono ? p.ink : p.eye ?? "#032C34";
    const [ir, pr] = tiny ? [8.8, 6.2] : cut === "small" ? [7, 4.9] : [6.3, 4.4];
    const gw = tiny ? 5.5 : cut === "small" ? 3.8 : 3.1;
    const gl = tiny ? 0.9 : 1;
    const gills = gill(97, 86, -132, 21 * gl, gw, p.accent) + gill(89, 93, -160, 22 * gl, gw, p.accent) + gill(84, 101, -172, 19 * gl, gw, p.accent);
    const head = cut === "full" ? SALLY_HEAD : SALLY_BUST;
    return `<g class="s-gills">${gills}</g><path fill="${p.fill}" d="${head}"/>
    ${tiny ? "" : dots(FRECKLES, spot)}
    <g class="s-eye"><circle fill="${iris}" cx="146" cy="92" r="${ir}"/><circle fill="${pupil}" cx="147.2" cy="92" r="${pr}"/></g>${cut === "full" ? `<path class="s-lid" opacity="0" fill="none" stroke="${line}" stroke-width="2.6" stroke-linecap="round" d="M140 93.5Q146 87 152 93.5"/>` : ""}
    <path fill="none" stroke="${line}" stroke-width="${tiny ? 4 : cut === "small" ? 2.8 : 2.2}" stroke-linecap="round" d="M166 104.8C158 105.2 149 104.6 141.5 102.6C138.8 101.9 137.2 100.6 136.8 98.6"/>`;
  };
  const MUG_FULL = "M40 114h88v38a22 22 0 0 1-22 22H62a22 22 0 0 1-22-22Z";
  const MUG = "M40 114h88v48a22 22 0 0 1-22 22H62a22 22 0 0 1-22-22Z", LIP = '<rect x="36" y="108" width="96" height="10" rx="5"/>';
  // measured bounds of the full mark, padded for stroke widths; keep in step with the drawing
  const SALLY_BOX = [29.2, 60.8, 157.9, 114.2];
  // the point a badge centres on and the farthest ink from it: across, three quarters of the way from the
  // bounds' centre to the ink's darkness-weighted centroid (so the heavy mug, not the snout, sits on the
  // centre line); down, only a quarter, so the gap under the mug stays close to the gap over her gills
  const SALLY_OPTIC = { cx: 100, cy: 120.6, reach: 88.3 };
  // a five-pointed star, point up, centred on (x, y)
  const star = (x, y, r) => "M" + Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.42 : r; return `${(x + q * Math.cos(a)).toFixed(2)} ${(y + q * Math.sin(a)).toFixed(2)}`; }).join("L") + "Z";
  const BIG = '<g transform="translate(104 113) scale(1.15) translate(-104 -113)">';
  const sally = (p, { head = false, tiny = false } = {}) => {
    // small sizes: her head with its chin on a short length of rim, so she still reads as peeking out of a mug
    const cut = (shape, w) => (p.mono ? `<g fill="${p.paper}" stroke="${p.paper}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${shape}</g>` : "");
    // the small mark: her head over the whole mug, without the tail and arm, so the mug still reads as a mug at 16 px
    if (head) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${tiny ? "32 44 172 144" : "32 60 156 128"}" role="img">${tiny ? `<g transform="translate(130 109) scale(1.3) translate(-130 -109)">${sallyFace(p, "tiny")}</g>` : sallyFace(p, "small")}
    ${cut(`<path d="${MUG}"/>${LIP}`, tiny ? 7 : 5)}<path fill="${p.ink}" d="${MUG}"/><g fill="${p.ink}">${LIP}</g>
    <path fill="none" stroke="${p.ink}" stroke-width="${tiny ? 16 : 13}" stroke-linecap="round" d="M128 132h7a18 18 0 0 1 0 36h-7"/>
    <rect fill="${p.paper}" x="40" y="${tiny ? 128 : 126}" width="88" height="${tiny ? 9 : 6}"/></svg>`;
    // her near hand over the rim: one even, slender limb from under her chin, and three toes
    const ARM = "M110 106C112.5 109.5 115 113.5 116.5 119";
    const TOES = "M116.5 119l-3.5 5M116.5 119l0.5 6M116.5 119l5 3.5";
    const arm = (col, w) => `<path fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" d="${ARM}"/><path fill="none" stroke="${col}" stroke-width="${w * 0.45}" stroke-linecap="round" d="${TOES}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SALLY_BOX.join(" ")}" role="img">
    <g class="s-in"><g class="s-tail"><g transform="translate(49 122) scale(1.15) translate(-49 -122)">${cut(`<path d="${SALLY_TAIL}"/>`, 4)}<path fill="${p.fill}" d="${SALLY_TAIL}"/>${dots(TAIL_FRECKLES, p.mono ? p.paper : p.spot ?? p.paper)}</g></g>
    <g class="s-body">${BIG}${cut(`<path d="${SALLY_HEAD}"/>`, 4)}${sallyFace(p, "full")}</g></g></g>
    ${cut(`<path d="${MUG_FULL}"/>${LIP}`, 5)}
    <path fill="none" stroke="${p.ink}" stroke-width="12" stroke-linecap="round" d="M128 127h7a16.5 16.5 0 0 1 0 33h-7"/>
    <path fill="${p.ink}" d="${MUG_FULL}"/><g fill="${p.ink}">${LIP}</g>
    <rect fill="${p.paper}" x="40" y="135" width="88" height="6"/>
    <g class="s-arm">${BIG}${p.mono ? arm(p.paper, 11) : ""}${arm(p.fill, 6.4)}</g></g></svg>`;
  };

  /* A golden-cheeked warbler: black cap, black bib, and the cheek the name is for. */
  const warbler = (p) => svg(`
    <defs><clipPath id="gc-head"><circle cx="128" cy="80" r="26"/></clipPath></defs>
    <path fill="none" stroke="${p.fill}" stroke-width="6" stroke-linecap="round" d="M46 176h112"/>
    <path fill="${p.ink}" d="M60 126 16 150l8 13 50-19Z"/>
    <g fill="none" stroke="${p.ink}" stroke-width="4.500" stroke-linecap="round"><path d="M96 150v24"/><path d="M111 148l2 26"/></g>
    <ellipse fill="${p.paper}" cx="94" cy="122" rx="45" ry="32" transform="rotate(-18 94 122)"/>
    <path fill="${p.ink}" d="M51 136C46 104 78 86 112 92c14 3 22 10 26 20-34-8-62 2-87 24Z"/>
    <path fill="${p.fill}" d="M62 122q26-22 54-8-18 22-52 22Z"/>
    <g fill="none" stroke="${p.paper}" stroke-width="3.500" stroke-linecap="round"><path d="M78 113l8 14"/><path d="M90 109l8 14"/></g>
    <ellipse fill="${p.ink}" cx="126" cy="106" rx="15" ry="10"/>
    <circle fill="${p.accent}" cx="128" cy="80" r="26"/>
    <g clip-path="url(#gc-head)"><rect fill="${p.ink}" x="96" y="50" width="64" height="19"/>
      <path fill="none" stroke="${p.ink}" stroke-width="5" d="M100 88 156 81"/></g>
    <circle fill="${p.ink}" cx="136" cy="83" r="5"/><circle fill="${p.paper}" cx="137.500" cy="81.500" r="1.600"/>
    <path fill="${p.ink}" d="M151 75l20 6-20 7Z"/>`);

  window.NAMES = {
    grackle: {
      id: "grackle", name: "Morning Grackle", words: ["Morning", "Grackle"], mascot: grackle,
      line: "Loud about mornings.",
      house: ["The Squawk", "double shot, orange peel, far too awake"],
      local: "Great-tailed grackles hold every Austin car park at sunrise, and they are not quiet about it.",
    },
    bat: {
      id: "bat", name: "Bat Nap", words: ["Bat", "Nap"], mascot: bat,
      line: "Up all night. Coffee all day.",
      house: ["Dusk Flight", "espresso under cold foam, dark at the top"],
      local: "The bats under the Congress Avenue bridge sleep through the whole day shift.",
    },
    turtle: {
      id: "turtle", name: "Turtle Stack", words: ["Turtle", "Stack"], mascot: turtle,
      line: "Good things pile up.",
      house: ["Triple Stack", "three shots, stacked, no hurry"],
      local: "Red-eared sliders pile onto the logs of Lady Bird Lake, three deep, to sit in the sun.",
    },
    sally: {
      id: "sally", name: "Sally Mander's", words: ["Sally", "Mander's"], mascot: sally, box: SALLY_BOX, optic: SALLY_OPTIC,
      line: "Spring-fed since this morning.",
      house: ["Sixty-Eight", "iced hibiscus espresso, cold as the springs"],
      local: "The Barton Springs salamander lives in the springs of one Austin creek and nowhere else.",
    },
    goldencheek: {
      id: "goldencheek", name: "Goldencheek", words: ["Golden", "cheek"], mascot: warbler,
      line: "A small song before work.",
      house: ["Cedar Honey", "latte, juniper honey, a pinch of salt"],
      local: "The golden-cheeked warbler nests only in the juniper of the Texas Hill Country.",
    },
  };
  // The wordmark as HTML, with a plain typographer's apostrophe (the drop that stood in for it
  // read as a gimmick).
  for (const n of Object.values(window.NAMES)) n.word = (stack) => (stack ? n.words.join("<br>") : n.name);
  window.NAMES.sally.word = (stack) => `Sally${stack ? "<br>" : " "}Mander’s`;

  // Alex picked Sally Mander's on 2026-11-13. The other four stay above as a record of the
  // shortlist; nothing lists them any more.
  window.NAME_IDS = ["sally"];

  // Sally Mander's own colours and type, in the same shape as a theme (see themes.js), so the
  // logo sheet and the cup can be drawn before a theme is chosen.
  window.BRAND = {
    id: "brand", title: "Sally Mander's", name: "sally",
    fonts: "Caprasimo&family=Archivo:wdth,wght@62..125,100..900",
    wm: "font-family:Caprasimo,serif;font-weight:400;letter-spacing:-.012em;line-height:.9",
    type: [["Caprasimo", "Caprasimo", 400], ["Archivo, condensed", "Archivo;font-stretch:75%", 600]],
    colors: [["Limestone", "#FBF3E4"], ["Deep pool", "#14464E"], ["Spring mauve", "#BF98A6"], ["Gill coral", "#E15A4E"], ["Spring", "#98D8D8"], ["Pecan", "#7D4E33"]],
    pal: {
      paper: { bg: "#FBF3E4", ink: "#14464E", fill: "#BF98A6", accent: "#E15A4E", paper: "#FBF3E4", spot: "#F9EEE0" },
      dark: { bg: "#14464E", ink: "#FBF3E4", fill: "#CFA8B6", accent: "#F57663", paper: "#14464E", spot: "#F9EEE0" },
      pop: { bg: "#98D8D8", ink: "#14464E", fill: "#A57C8B", accent: "#D65145", paper: "#FBF3E4", spot: "#F9EEE0" },
    },
    cup: { body: "#FBF3E4", lid: "#14464E", pal: "paper", ink: "#14464E" },
  };
}
