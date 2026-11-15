// The sign painter's four faces, fetched from Google Fonts at build time and served from this
// site, so a visitor's browser never asks Google for anything (and the CSP can say font-src 'self').
import { Barlow, Barlow_Condensed, Big_Shoulders, Yellowtail } from "next/font/google";

/** One-stroke brush script: the wordmark, the headings, the handwriting on the checks. */
export const script = Yellowtail({ weight: "400", subsets: ["latin"], variable: "--font-script" });

/** Block capitals for the menu board. Variable, with optical size pinned to its display end in CSS. */
// (Next has no metrics for this family yet, so no size-matched fallback; it is only display type.)
export const block = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-block", adjustFontFallback: false });

/** Body copy. */
export const body = Barlow({ weight: ["400", "500", "600"], subsets: ["latin"], variable: "--font-body" });

/** Condensed caps for labels, prices and buttons. */
export const cond = Barlow_Condensed({ weight: ["500", "600", "700"], subsets: ["latin"], variable: "--font-cond" });

export const fontVariables = [script, block, body, cond].map((f) => f.variable).join(" ");
