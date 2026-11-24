// The levers: the changes the manager may try on the shop (server/board). Each is a bounded edit to
// one knob of the simulator, and each costs something or has a side effect, so a change can lose
// and be taken back. The catalogue is code, not data: a new lever is a pull request, reviewed
// like any other change to how the shop runs.
//
// None of them touches a price. The menu board and visitors' orders read the menu's prices, so a
// price the simulator charged and the board didn't show would be two shops at once.

/** What a regular can bring up, in their words; each lever answers one. */
export const TOPICS = {
  line: "the morning line",
  wait: "the wait for a drink",
  pickup: "picking up an order",
  food: "something to eat with it",
  afternoon: "a quiet afternoon",
  evening: "the evenings",
} as const;
export type Topic = keyof typeof TOPICS;

export interface Lever {
  /** how the board and the notes name it; it may hold digits, so it is always passed as a figure */
  name: string;
  /** what changes in the shop, in a line */
  what: string;
  /** what it costs, or what it puts at risk, in a line */
  cost: string;
  answers: Topic;
  /** barista hours a day it adds, on top of the shop's usual crew */
  staffHours: number;
  /** the Austin hours it touches, [from, to), or null for all day */
  hours: [number, number] | null;
}

export const LEVERS = {
  rushBarista: {
    name: "A third barista, 7–10 am",
    what: "A third pair of hands on the bar through the morning rush, so the bar makes half as many drinks again in those hours.",
    cost: "three more barista hours a day",
    answers: "line",
    staffHours: 3,
    hours: [7, 10],
  },
  prepAhead: {
    name: "Prep ahead",
    what: "Milk pitchers set out, pastries plated and the cold brew decanted before the rush, so each item takes less time to make.",
    cost: "an hour of prep a day",
    answers: "wait",
    staffHours: 1,
    hours: null,
  },
  pickupShelf: {
    name: "A pickup shelf",
    what: "A shelf at the end of the bar where finished orders wait, named on the cup, so nobody hovers at the hand-off.",
    cost: "nothing on the rota, only a shelf",
    answers: "pickup",
    staffHours: 0,
    hours: null,
  },
  pastryPairing: {
    name: "A pastry with your coffee, at the till",
    what: "The till suggests something from the warmer with a morning drink, so more morning checks carry a second item.",
    cost: "longer waits, since bigger orders take longer to make",
    answers: "food",
    staffHours: 0,
    hours: [6, 10],
  },
  sidewalkSign: {
    name: "A cold-brew sign on the sidewalk, 2–5 pm",
    what: "A chalkboard out front through the afternoon lull, so more people passing come in.",
    cost: "a longer afternoon wait, with more orders on the same crew",
    answers: "afternoon",
    staffHours: 0,
    hours: [14, 17],
  },
  eveningBarista: {
    name: "A second barista until 11 pm",
    what: "The day crew stays two strong for the first two hours of the night shift.",
    cost: "two more barista hours a day",
    answers: "evening",
    staffHours: 2,
    hours: [21, 23],
  },
} as const satisfies Record<string, Lever>;

export type LeverId = keyof typeof LEVERS;

export const LEVER_IDS = Object.keys(LEVERS) as LeverId[];

export const isLeverId = (s: unknown): s is LeverId => typeof s === "string" && Object.hasOwn(LEVERS, s);

/** Barista hours in a day with no lever: two baristas 6 am–9 pm, one through the night. */
export const BASE_STAFF_HOURS = 2 * 15 + 9;

export const staffHours = (levers: readonly LeverId[]) => BASE_STAFF_HOURS + levers.reduce((s, id) => s + LEVERS[id].staffHours, 0);

const inHours = (hour: number, [from, to]: readonly [number, number]) => hour >= from && hour < to;

/**
 * The simulator's knobs with these levers in effect. With none, every value is the simulator's own
 * default, so a day with no lever is the day it always was.
 */
export function tuning(levers: readonly LeverId[]) {
  const on = new Set(levers);
  return {
    /** what the bar can make in this hour, from what it makes with the usual crew */
    capacity(hour: number, usual: number): number {
      if (on.has("rushBarista") && inHours(hour, LEVERS.rushBarista.hours)) return usual * 1.5;
      if (on.has("eveningBarista") && inHours(hour, LEVERS.eveningBarista.hours)) return 38;
      return usual;
    },
    /** how many more people come in this hour than would anyway */
    demand(hour: number): number {
      return on.has("sidewalkSign") && inHours(hour, LEVERS.sidewalkSign.hours) ? 1.15 : 1;
    },
    /** the odds an order in this hour is a single item */
    oneItem(hour: number): number {
      return on.has("pastryPairing") && inHours(hour, LEVERS.pastryPairing.hours) ? 0.55 : 0.62;
    },
    /** seconds before the first item, and for each item */
    baseSeconds: on.has("pickupShelf") ? 65 : 80,
    itemSeconds: on.has("prepAhead") ? 28 : 34,
  };
}
