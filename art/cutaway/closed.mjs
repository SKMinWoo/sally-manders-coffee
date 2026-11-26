// The café's closed frame, composed from the layers the page lifts it into, so the swap at the lift
// changes no pixel (Alex, 2026-11-26: "the walls and lighting throughout still flicker before the
// roof lifts off"). It used to be the Study's lamplit render, whose light and shadows differ from
// the shop's own passes; the page cross-faded the two and every wall shifted.
//
//     node art/cutaway/closed.mjs shade.png
//
// shade.png is cutaway.py's shade pass at --width=2400 (roof on but unseen). Its page shadow is cut
// (alpha below 0.98 goes) so it never doubles the beauty's own. Writes public/cutaway/hero-shade.webp
// and public/cutaway/hero-closed.webp (= beauty + shade + shell at 2400 wide). The portfolio's
// public/study/shop-closed.webp must be a byte copy of the new hero-closed.webp.
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, "../../public/cutaway");
const W = 2400, CUT = Math.round(0.98 * 255);

const src = process.argv[2];
if (!src) throw new Error("usage: node art/cutaway/closed.mjs shade.png");
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== W) throw new Error(`shade is ${info.width} wide, expected ${W}`);
const H = info.height;
for (let i = 3; i < data.length; i += 4) if (data[i] < CUT) data[i] = 0; else data[i] = 255;
const shade = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
await sharp(shade).webp({ quality: 95, alphaQuality: 100 }).toFile(path.join(PUB, "hero-shade.webp"));

const at = async (f) => sharp(await sharp(path.join(PUB, f)).png().toBuffer()).resize(W, H).png().toBuffer();
const closed = await sharp(await at("hero-beauty.webp"))
  .composite([{ input: shade }, { input: await at("hero-shell.webp") }])
  .png().toBuffer();
await sharp(closed).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(PUB, "hero-closed.webp"));
console.log("wrote hero-shade.webp and hero-closed.webp", W, H);
