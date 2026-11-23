// The board as a visitor reads it: this morning's calls, what's been heard, the change planned or
// being tried, what was measured, and the shop as it stands now. Planned and trying aren't stored;
// they follow from the dates (a live change before its first day is planned, from it on, trying).

import { addDays, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { LEVER_IDS, LEVERS, TOPICS, type LeverId, type Topic } from "@/server/simulator";
import { measure, type Effect } from "./measure";
import { TRIAL_DAYS, unavailable } from "./plan";
import { REGULARS } from "./regulars";
import { allExperiments, callsSince, experimentCounts, type Call, type CustomerCall, type Experiment, type ManagerCall } from "./repository";
import { daysFrom } from "./standup";
import { deltas, type Deltas } from "./verdict";

/** How far back the Heard column reaches. */
export const HEARD_DAYS = 14;
/**
 * How far back the call log reaches: four weeks, so the morning that chose the change in the
 * Measured column (a planned day, a week's trial and the morning it's measured, at the least) is
 * still in it when a visitor wants to know why it was tried.
 */
export const LOG_DAYS = 28;

export interface Card {
  id: number;
  lever: LeverId;
  name: string;
  what: string;
  cost: string;
  /** what the change answers, and what was being said when it was chosen */
  answers: string;
  heard: string;
  proposedOn: ShopDate;
  startsOn: ShopDate;
  endsOn: ShopDate;
  /** trying only: which day of its week today is */
  day: number | null;
  /** the effect: so far (trying, over the days already over) or final (measured) */
  effect: Effect | null;
  deltas: Deltas | null;
  verdict: "kept" | "rolled-back" | null;
  measuredOn: ShopDate | null;
}

export interface Heard {
  topic: Topic;
  label: string;
  times: number;
  /** the newest call that raised it */
  latest: { day: ShopDate; speaker: string };
}

export type Morning = {
  day: ShopDate;
  customer: (CustomerCall & { speakerName: string; speakerWho: string }) | null;
  manager: ManagerCall | null;
  /** the change the manager chose that morning, by name, or null when they held */
  chose: string | null;
  /** when they held: the change that was planned or on trial that morning, so they couldn't choose */
  heldFor: string | null;
};

/** While a change is on trial: the morning the next one is chosen, and what could be chosen then. */
export interface Next {
  on: ShopDate;
  open: { lever: LeverId; name: string }[];
}

/** A change that's part of the shop now, and what its week showed against the same week without it. */
export interface Standing {
  lever: LeverId;
  name: string;
  since: ShopDate;
  deltas: Deltas | null;
  /** the morning it was chosen, and what the regular had raised that morning */
  proposedOn: ShopDate;
  heard: string;
}

export interface Board {
  today: ShopDate;
  /** the newest morning with a call, then the ones before it, newest first */
  latest: Morning | null;
  log: Morning[];
  heard: Heard[];
  planned: Card | null;
  trying: Card | null;
  /** trying only: when the next change is chosen, and the ones still on the list */
  next: Next | null;
  measured: Card[];
  /** the changes kept, oldest first: the shop as it stands */
  standing: Standing[];
  counts: { tried: number; kept: number; since: ShopDate | null };
}

function card(e: Experiment, extra: Partial<Card> = {}): Card {
  const l = LEVERS[e.lever];
  return {
    id: e.id,
    lever: e.lever,
    name: l.name,
    what: l.what,
    cost: l.cost,
    answers: TOPICS[l.answers],
    heard: TOPICS[e.heard],
    proposedOn: e.proposedOn,
    startsOn: e.startsOn,
    endsOn: e.endsOn,
    day: null,
    effect: e.effect,
    deltas: e.effect ? deltas(e.effect) : null,
    verdict: e.verdict,
    measuredOn: e.measuredOn,
    ...extra,
  };
}

const speakerOf = (id: string) => REGULARS.find((r) => r.id === id);

/** The change already chosen and not yet measured on a morning: from the morning after it was chosen to its last day. */
const runningOn = (all: readonly Experiment[], day: ShopDate) => all.find((e) => e.proposedOn < day && day <= e.endsOn) ?? null;

function mornings(calls: readonly Call[], all: readonly Experiment[]): Morning[] {
  const byDay = new Map<ShopDate, Morning>();
  for (const c of calls) {
    const running = runningOn(all, c.day);
    const m: Morning = byDay.get(c.day) ?? { day: c.day, customer: null, manager: null, chose: null, heldFor: running && LEVERS[running.lever].name };
    if (c.kind === "customer") {
      const r = speakerOf(c.speaker);
      m.customer = { ...c, speakerName: r?.name ?? c.speaker, speakerWho: r?.who ?? "" };
    } else {
      m.manager = c;
      m.chose = c.payload.decision ? LEVERS[c.payload.decision].name : null;
      if (m.chose) m.heldFor = null;
    }
    byDay.set(c.day, m);
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export async function boardView(db: Db, now: Date): Promise<Board> {
  const today = shopToday(now);
  const yesterday = addDays(today, -1);
  const [all, counts, calls] = await Promise.all([allExperiments(db), experimentCounts(db), callsSince(db, addDays(today, -(LOG_DAYS - 1)))]);

  const heardSince = addDays(today, -(HEARD_DAYS - 1));
  const heard = new Map<Topic, Heard>();
  for (const c of calls) {
    if (c.kind !== "customer" || c.day < heardSince) continue;
    const h = heard.get(c.payload.topic);
    if (h) h.times++;
    else heard.set(c.payload.topic, { topic: c.payload.topic, label: TOPICS[c.payload.topic], times: 1, latest: { day: c.day, speaker: speakerOf(c.speaker)?.name ?? c.speaker } });
  }

  const live = all.find((e) => e.status === "live") ?? null;
  let planned: Card | null = null;
  let trying: Card | null = null;
  if (live && live.startsOn > today) planned = card(live);
  else if (live) {
    const last = yesterday < live.endsOn ? yesterday : live.endsOn;
    const soFar = last >= live.startsOn ? await measure(db, live.lever, daysFrom(live.startsOn, last)) : null;
    const day = Math.min(daysFrom(live.startsOn, today).length, TRIAL_DAYS);
    trying = card(live, { day, effect: soFar, deltas: soFar ? deltas(soFar) : null });
  }

  // the morning after a trial's last day measures it, and the manager may choose again; what they
  // could choose is what the repository would allow on that morning, the live change aside
  let next: Next | null = null;
  if (live) {
    const on = addDays(live.endsOn, 1);
    const others = all.filter((e) => e.id !== live.id);
    next = {
      on,
      open: LEVER_IDS.filter((id) => id !== live.lever && unavailable(others, id, on) === null).map((id) => ({ lever: id, name: LEVERS[id].name })),
    };
  }

  const [latest, ...log] = mornings(calls, all);
  return {
    today,
    latest: latest ?? null,
    log,
    heard: [...heard.values()].sort((a, b) => b.times - a.times || (a.latest.day < b.latest.day ? 1 : -1)),
    planned,
    trying,
    next,
    measured: all.filter((e) => e.status === "measured").map((e) => card(e)).sort((a, b) => ((a.measuredOn ?? "") < (b.measuredOn ?? "") ? 1 : -1)),
    standing: all
      .filter((e) => e.verdict === "kept")
      .map((e) => ({
        lever: e.lever,
        name: LEVERS[e.lever].name,
        since: e.startsOn,
        deltas: e.effect ? deltas(e.effect) : null,
        proposedOn: e.proposedOn,
        heard: TOPICS[e.heard],
      })),
    counts: { tried: counts.tried, kept: counts.kept, since: counts.first },
  };
}

/** The front page's one line: the change being tried, else the one coming, else the newest kept. */
export type BoardLine =
  | { kind: "trying"; name: string; day: number; of: number }
  | { kind: "planned"; name: string; startsOn: ShopDate }
  | { kind: "kept"; name: string; since: ShopDate }
  | null;

export function lineOf(b: Board): BoardLine {
  if (b.trying) return { kind: "trying", name: b.trying.name, day: b.trying.day ?? 1, of: TRIAL_DAYS };
  if (b.planned) return { kind: "planned", name: b.planned.name, startsOn: b.planned.startsOn };
  const kept = b.standing.at(-1);
  return kept ? { kind: "kept", name: kept.name, since: kept.since } : null;
}
