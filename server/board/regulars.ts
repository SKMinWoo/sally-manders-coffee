// The regulars: four people who come in at their own time of day, so between them the morning
// call hears about every part of the shop. They take turns, one a morning, in a fixed order, so
// each is heard from every fourth day. They are characters for the model to speak as, and the
// page says so; what they report is the simulator's figures for their hour, never their own.

import type { ShopDate } from "@/lib/time";
import type { Topic } from "@/server/simulator";

export interface Regular {
  id: string;
  name: string;
  /** who they are, for the model, in a line */
  who: string;
  /** the Austin hour they come in */
  hour: number;
  /** what they always have */
  usual: string;
  /** what they'd bring up first when nothing else stood out, in the order they'd reach for it */
  cares: [Topic, Topic];
}

export const REGULARS: readonly Regular[] = [
  { id: "dana", name: "Dana", who: "a nurse coming off the night shift at the hospital up the road, who stops in on the way home", hour: 7, usual: "drip", cares: ["line", "food"] },
  { id: "mateo", name: "Mateo", who: "a graduate student who works through lunch at the window table", hour: 12, usual: "cold-brew", cares: ["wait", "pickup"] },
  { id: "priya", name: "Priya", who: "a parent on the way back from the school run, often with a child in tow", hour: 15, usual: "chai", cares: ["afternoon", "food"] },
  { id: "june", name: "June", who: "an illustrator who draws here after dinner, most nights", hour: 21, usual: "sixty-eight", cares: ["evening", "wait"] },
];

/** Calendar days from 2026-01-04 (both read as UTC midnights, so no clock change can bend the count). */
const dayNumber = (day: ShopDate) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse("2026-01-04T00:00:00Z")) / 86_400_000);

/** Whose turn it is to talk about `day`. */
export function regularFor(day: ShopDate): Regular {
  const n = dayNumber(day) % REGULARS.length;
  return REGULARS[(n + REGULARS.length) % REGULARS.length]!;
}
