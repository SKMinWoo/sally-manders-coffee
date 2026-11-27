// The lifting roof without holes, and the things it passes behind (Alex, 2026-11-27: "there are holes
// cut out over where there are objects 'on top' of what is being lifted").
//
//     node art/cutaway/front.mjs
//
// cutaway.py's shell pass holds out everything in front of the shell, so the street lamp, its post,
// the sandwich board and the van's roof are cut out of hero-shell.webp. While the roof sat still the
// beauty showed through those cut-outs and nobody could tell; once it lifts, the holes go up with it.
// This fills each hole from the shell's own neighbouring surface (the awning and the door glass one
// stripe pair along, the wall a step along its bottom edge, the plaster above the van's line) and
// writes the held-out objects as their own layers, which the page lays over the roof:
//
//   hero-shell.webp        the shell, holes filled (overwritten in place; run once on a fresh render)
//   hero-front.webp        the held-out objects as the beauty pass shows them (the page in its light)
//   hero-front-shade.webp  the same, as the shade pass shows them (roof on, its shadow cast)
//
// The page shows the front shade while the shade is up and crosses to the front as the shade lets go.
// Each has alpha 1 - (old shell alpha / new shell alpha), and a pixel the old shell partly covered keeps
// its colour, so beauty + shade + new shell + front shade is the old picture to the pixel (hero-closed,
// which closed.mjs composed from the old shell: run that first, then this, on a fresh render).
// A re-render that renders the shell without holdouts (and these objects as a pass of their own)
// makes this script unnecessary.
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, "../../public/cutaway");

const raw = async (f, w, h) => {
  let img = sharp(path.join(PUB, f)).ensureAlpha();
  if (w) img = img.resize(w, h);
  return img.raw().toBuffer({ resolveWithObject: true });
};
const { data: old, info } = await raw("hero-shell.webp");
const W = info.width, H = info.height;
if (W !== 3600) throw new Error(`hero-shell.webp is ${W} wide, expected 3600`);
const { data: beauty } = await raw("hero-beauty.webp", W, H);
const { data: shade } = await raw("hero-shade.webp", W, H);
const shell = Buffer.from(old);
const at = (x, y) => (y * W + x) * 4;

// fill (x, y) up to alpha a with the shell's own surface from (sx, sy). A pixel the old shell already
// partly covers keeps its colour (unpremultiplied, that is the surface's colour) and only gains alpha:
// that is what keeps the stack below equal to the old picture to the pixel
function fill(x, y, sx, sy, a) {
  const d = at(x, y), s = at(sx, sy);
  if (a <= shell[d + 3] + 2) return;
  if (old[d + 3] < 16) for (let c = 0; c < 3; c++) shell[d + c] = shell[s + c];
  shell[d + 3] = Math.round(a);
}
const take = (x, y, sx, sy) => fill(x, y, sx, sy, shell[at(sx, sy) + 3]);

// the street lamp's globe on the awning, and its post down the door glass: the awning's stripes repeat
// every 22.7px along its edge, which falls 0.28px a pixel, so two stripes along is (-45, -13)
for (let y = 1018; y <= 1106; y++)
  for (let x = 2706; x <= 2796; x++) if ((x - 2750) ** 2 + (y - 1062) ** 2 <= 44 ** 2) take(x, y, x - 45, y - 13);
for (let y = 1080; y <= 1406; y++) for (let x = 2743; x <= 2770; x++) take(x, y, x - 45, y - 13);

// the sandwich board's notch in the shopfront's bottom edge: the wall carried along that edge 25px at a
// time from its left, so the light on the plaster keeps changing as it does beside the notch
for (let y = 1228; y <= 1340; y++) for (let x = 2368; x <= 2488; x++) take(x, y, x - 25, y - 7);

// the van's roof along the bottom of the left-hand bay: the wall's edge carries on in line with the
// part the van leaves alone (919 at x 1350, falling 0.28px a pixel); the plaster just above the van's
// line is mirrored down to it, back and forth over the clean plaster between it and the shelf's shadow
// (at most 14 rows) so no seam repeats
for (let x = 1004; x <= 1324; x++) {
  const edge = 919 + 0.28 * (x - 1350);
  let top = -1;
  for (let y = Math.floor(edge); y >= Math.floor(edge) - 80; y--) if (old[at(x, y) + 3] >= 250) { top = y - 1; break; }
  if (top < 0) continue;
  const lum = (y) => old[at(x, y)] + old[at(x, y) + 1] + old[at(x, y) + 2];
  let n = 1;
  while (n < 14 && lum(top - n) > 0.8 * lum(top)) n++;
  for (let y = top + 1; y <= Math.ceil(edge) + 1; y++) {
    const d = at(x, y), k = (y - top - 1) % (2 * n), s = at(x, top - (k < n ? k : 2 * n - 1 - k));
    const a = Math.round(Math.max(0, Math.min(1, edge - y)) * 255);
    if (a <= old[d + 3] + 2) continue;
    if (old[d + 3] < 16) for (let c = 0; c < 3; c++) shell[d + c] = shell[s + c];
    shell[d + 3] = a;
  }
}

// what the roof now covers that used to show through it: those are the objects in front
const front = Buffer.alloc(W * H * 4), frontShade = Buffer.alloc(W * H * 4);
let n = 0;
for (let i = 0; i < W * H * 4; i += 4) {
  const a0 = old[i + 3], a1 = shell[i + 3];
  if (a1 <= a0) continue;
  const f = Math.round(255 * (1 - a0 / a1));
  if (!f) continue;
  n++;
  const k = shade[i + 3] / 255; // the shade as it lies over the beauty
  for (let c = 0; c < 3; c++) { front[i + c] = beauty[i + c]; frontShade[i + c] = Math.round(beauty[i + c] * (1 - k) + shade[i + c] * k); }
  front[i + 3] = frontShade[i + 3] = f;
}

// the objects are small and sit on top of every pixel they cover, so they go lossless
const out = (buf, f, lossless = false) => sharp(buf, { raw: { width: W, height: H, channels: 4 } }).webp(lossless ? { lossless: true } : { quality: 92, alphaQuality: 100 }).toFile(path.join(PUB, f));
await out(shell, "hero-shell.webp");
await out(front, "hero-front.webp", true);
await out(frontShade, "hero-front-shade.webp", true);
console.log(`filled ${n} pixels; wrote hero-shell.webp, hero-front.webp, hero-front-shade.webp`);
