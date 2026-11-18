// The guests' figures: the Study's peg people, rendered alone from the hero camera's line of sight on
// the café floor (art/cutaway/cutaway.py --pegs), once under the reading lamp and once with it off.
// cutaway.json's "peg" says where the feet and the walk's 1.6 m mark fall in each sprite.
import type { StaticImageData } from "next/image";
import mustardNight from "@/public/cutaway/peg-mustard-night.webp";
import navyNight from "@/public/cutaway/peg-navy-night.webp";
import oxbloodNight from "@/public/cutaway/peg-oxblood-night.webp";
import tealNight from "@/public/cutaway/peg-teal-night.webp";
import mustardDark from "@/public/cutaway/peg-mustard-dark.webp";
import navyDark from "@/public/cutaway/peg-navy-dark.webp";
import oxbloodDark from "@/public/cutaway/peg-oxblood-dark.webp";
import tealDark from "@/public/cutaway/peg-teal-dark.webp";

export type PegLight = "night" | "dark";
export interface PegSprites {
  /** a simulated guest is painted one of these, picked by its order */
  simulated: StaticImageData[];
  /** a real visitor's order is always teal, as the caption's key says */
  visitor: StaticImageData;
}

export const PEGS: Record<PegLight, PegSprites> = {
  night: { simulated: [mustardNight, navyNight, oxbloodNight], visitor: tealNight },
  dark: { simulated: [mustardDark, navyDark, oxbloodDark], visitor: tealDark },
};

/** Where the sprite's feet and the 1.6 m mark sit, in its own pixels (cutaway.json's "peg"). */
export interface PegMeta {
  size: [number, number];
  foot: [number, number];
  top: [number, number];
}
