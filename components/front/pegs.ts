// The figures on the model: the Study's peg people, rendered alone from the hero camera's line of
// sight on the café floor (art/cutaway/cutaway.py --pegs), once under the reading lamp and once with
// it off. Each guest walks empty-handed, carries one of the set's three cups (a cream tumbler, a
// kraft cup, a mustard mug), and sits dropped into a chair's brass socket; the baristas are the toy's
// red-aproned staff, and each cup also stands alone, on the pass, a table or the window ledge. Every
// sprite is framed the same way, so cutaway.json's "peg" (where the feet and the 1.6 m mark fall)
// serves them all.
import type { StaticImageData } from "next/image";
import type { CupKind } from "@/lib/footfall";
import mustardNight from "@/public/cutaway/peg-mustard-night.webp";
import mustardTumblerNight from "@/public/cutaway/peg-mustard-cup-tumbler-night.webp";
import mustardKraftNight from "@/public/cutaway/peg-mustard-cup-kraft-night.webp";
import mustardMugNight from "@/public/cutaway/peg-mustard-cup-mug-night.webp";
import mustardSeatedNight from "@/public/cutaway/peg-mustard-seated-night.webp";
import navyNight from "@/public/cutaway/peg-navy-night.webp";
import navyTumblerNight from "@/public/cutaway/peg-navy-cup-tumbler-night.webp";
import navyKraftNight from "@/public/cutaway/peg-navy-cup-kraft-night.webp";
import navyMugNight from "@/public/cutaway/peg-navy-cup-mug-night.webp";
import navySeatedNight from "@/public/cutaway/peg-navy-seated-night.webp";
import oxbloodNight from "@/public/cutaway/peg-oxblood-night.webp";
import oxbloodTumblerNight from "@/public/cutaway/peg-oxblood-cup-tumbler-night.webp";
import oxbloodKraftNight from "@/public/cutaway/peg-oxblood-cup-kraft-night.webp";
import oxbloodMugNight from "@/public/cutaway/peg-oxblood-cup-mug-night.webp";
import oxbloodSeatedNight from "@/public/cutaway/peg-oxblood-seated-night.webp";
import tealNight from "@/public/cutaway/peg-teal-night.webp";
import tealTumblerNight from "@/public/cutaway/peg-teal-cup-tumbler-night.webp";
import tealKraftNight from "@/public/cutaway/peg-teal-cup-kraft-night.webp";
import tealMugNight from "@/public/cutaway/peg-teal-cup-mug-night.webp";
import tealSeatedNight from "@/public/cutaway/peg-teal-seated-night.webp";
import mustardDark from "@/public/cutaway/peg-mustard-dark.webp";
import mustardTumblerDark from "@/public/cutaway/peg-mustard-cup-tumbler-dark.webp";
import mustardKraftDark from "@/public/cutaway/peg-mustard-cup-kraft-dark.webp";
import mustardMugDark from "@/public/cutaway/peg-mustard-cup-mug-dark.webp";
import mustardSeatedDark from "@/public/cutaway/peg-mustard-seated-dark.webp";
import navyDark from "@/public/cutaway/peg-navy-dark.webp";
import navyTumblerDark from "@/public/cutaway/peg-navy-cup-tumbler-dark.webp";
import navyKraftDark from "@/public/cutaway/peg-navy-cup-kraft-dark.webp";
import navyMugDark from "@/public/cutaway/peg-navy-cup-mug-dark.webp";
import navySeatedDark from "@/public/cutaway/peg-navy-seated-dark.webp";
import oxbloodDark from "@/public/cutaway/peg-oxblood-dark.webp";
import oxbloodTumblerDark from "@/public/cutaway/peg-oxblood-cup-tumbler-dark.webp";
import oxbloodKraftDark from "@/public/cutaway/peg-oxblood-cup-kraft-dark.webp";
import oxbloodMugDark from "@/public/cutaway/peg-oxblood-cup-mug-dark.webp";
import oxbloodSeatedDark from "@/public/cutaway/peg-oxblood-seated-dark.webp";
import tealDark from "@/public/cutaway/peg-teal-dark.webp";
import tealTumblerDark from "@/public/cutaway/peg-teal-cup-tumbler-dark.webp";
import tealKraftDark from "@/public/cutaway/peg-teal-cup-kraft-dark.webp";
import tealMugDark from "@/public/cutaway/peg-teal-cup-mug-dark.webp";
import tealSeatedDark from "@/public/cutaway/peg-teal-seated-dark.webp";
import baristaNight from "@/public/cutaway/barista-night.webp";
import baristaDark from "@/public/cutaway/barista-dark.webp";
import tumblerNight from "@/public/cutaway/cup-tumbler-night.webp";
import kraftNight from "@/public/cutaway/cup-kraft-night.webp";
import mugNight from "@/public/cutaway/cup-mug-night.webp";
import tumblerDark from "@/public/cutaway/cup-tumbler-dark.webp";
import kraftDark from "@/public/cutaway/cup-kraft-dark.webp";
import mugDark from "@/public/cutaway/cup-mug-dark.webp";
import occNight from "@/public/cutaway/occ-night.webp";
import occDark from "@/public/cutaway/occ-dark.webp";

export type PegLight = "night" | "dark";
type Cups = Record<CupKind, StaticImageData>;
/** One guest's paint: walking, carrying each kind of cup, and sat in a chair. */
export interface Guest {
  walk: StaticImageData;
  cup: Cups;
  seated: StaticImageData;
}
export interface PegSprites {
  /** a simulated guest is painted one of these, picked by its order */
  simulated: Guest[];
  /** a real visitor's order is always teal, as the caption's key says */
  visitor: Guest;
  barista: StaticImageData;
  /** each cup on its own, set down */
  cups: Cups;
  /** every occluder, cut from this light's frame (cutaway.json's "occluders" says where) */
  occluders: StaticImageData;
}

export const PEGS: Record<PegLight, PegSprites> = {
  night: {
    simulated: [
      { walk: mustardNight, cup: { tumbler: mustardTumblerNight, kraft: mustardKraftNight, mug: mustardMugNight }, seated: mustardSeatedNight },
      { walk: navyNight, cup: { tumbler: navyTumblerNight, kraft: navyKraftNight, mug: navyMugNight }, seated: navySeatedNight },
      { walk: oxbloodNight, cup: { tumbler: oxbloodTumblerNight, kraft: oxbloodKraftNight, mug: oxbloodMugNight }, seated: oxbloodSeatedNight },
    ],
    visitor: { walk: tealNight, cup: { tumbler: tealTumblerNight, kraft: tealKraftNight, mug: tealMugNight }, seated: tealSeatedNight },
    barista: baristaNight,
    cups: { tumbler: tumblerNight, kraft: kraftNight, mug: mugNight },
    occluders: occNight,
  },
  dark: {
    simulated: [
      { walk: mustardDark, cup: { tumbler: mustardTumblerDark, kraft: mustardKraftDark, mug: mustardMugDark }, seated: mustardSeatedDark },
      { walk: navyDark, cup: { tumbler: navyTumblerDark, kraft: navyKraftDark, mug: navyMugDark }, seated: navySeatedDark },
      { walk: oxbloodDark, cup: { tumbler: oxbloodTumblerDark, kraft: oxbloodKraftDark, mug: oxbloodMugDark }, seated: oxbloodSeatedDark },
    ],
    visitor: { walk: tealDark, cup: { tumbler: tealTumblerDark, kraft: tealKraftDark, mug: tealMugDark }, seated: tealSeatedDark },
    barista: baristaDark,
    cups: { tumbler: tumblerDark, kraft: kraftDark, mug: mugDark },
    occluders: occDark,
  },
};

/** Where the sprite's feet and the 1.6 m mark sit, in its own pixels (cutaway.json's "peg"). */
export interface PegMeta {
  size: [number, number];
  foot: [number, number];
  top: [number, number];
}

/** One occluder in the atlas: where it sits on the render, where in the atlas, and its floor footprint. */
export interface Occluder {
  id: string;
  frame: [number, number, number, number];
  at: [number, number];
  floor: [number, number, number, number][];
}
export interface Occluders {
  atlas: [number, number];
  items: Occluder[];
}
