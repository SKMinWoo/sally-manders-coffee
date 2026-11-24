// Each fixture's close-up: its rectangle of the hero (cutaway.json's "close"), rendered at twice the
// density with the focus moved onto it (art/cutaway/cutaway.py --close). The guests' view tags three
// fixtures under the lamp; "What runs it" pins them all with the lamp off.
import type { StaticImageData } from "next/image";
import type { FixtureKey } from "./fixtures";
import doorBeauty from "@/public/cutaway/close/door-beauty.webp";
import boardsBeauty from "@/public/cutaway/close/boards-beauty.webp";
import tillBeauty from "@/public/cutaway/close/till-beauty.webp";
import door from "@/public/cutaway/close/door-dark.webp";
import boards from "@/public/cutaway/close/boards-dark.webp";
import till from "@/public/cutaway/close/till-dark.webp";
import scanner from "@/public/cutaway/close/scanner-dark.webp";
import rail from "@/public/cutaway/close/rail-dark.webp";
import machine from "@/public/cutaway/close/machine-dark.webp";
import desk from "@/public/cutaway/close/desk-dark.webp";
import cabinet from "@/public/cutaway/close/cabinet-dark.webp";
import certificate from "@/public/cutaway/close/certificate-dark.webp";
import clock from "@/public/cutaway/close/clock-dark.webp";
import van from "@/public/cutaway/close/van-dark.webp";
import pantry from "@/public/cutaway/close/pantry-dark.webp";
import dining from "@/public/cutaway/close/dining-dark.webp";

export const CLOSEUPS: Record<"beauty" | "dark", Partial<Record<FixtureKey, StaticImageData>>> = {
  beauty: { door: doorBeauty, boards: boardsBeauty, till: tillBeauty },
  dark: { door, boards, till, scanner, rail, machine, desk, cabinet, certificate, clock, van, pantry, dining },
};
