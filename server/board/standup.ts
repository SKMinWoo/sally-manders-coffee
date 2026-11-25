// The morning standup, once a day before the simulator writes tomorrow (vercel.json, 08:30 UTC):
//
//   1. a change whose week is over is measured, and kept or taken back (verdict.ts decides);
//   2. a regular calls about their visit yesterday (customer.ts);
//   3. the manager answers and decides: hold, or try one change (manager.ts; the repository
//      decides whether the decision stands);
//   4. a change decided on starts on the first day not yet written, normally tomorrow, so the
//      simulate job half an hour later writes it in.
//
// A call is keyed by the morning it's made, and talks about the day before. Every step is safe to
// run twice: a measured change isn't measured again, and a morning with its calls is left alone.

import { addDays, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { dayFigures, parts, type ModelConfig } from "@/server/brief";
import { firstUnwritten, LEVER_IDS, LEVERS, type LeverId, type Topic } from "@/server/simulator";
import { speakAsRegular } from "./customer";
import { merge, plannedFigures, trialFigures, verdictFigures, visitFigures, type Figure } from "./figures";
import { decide } from "./manager";
import { measure } from "./measure";
import { TRIAL_DAYS, trialEnd, unavailable } from "./plan";
import { regularFor, type Regular } from "./regulars";
import { allExperiments, callsOn, callsSince, closeExperiment, insertCall, startExperiment, type CustomerCall, type Experiment } from "./repository";
import { verdictOf } from "./verdict";

export type StandupConfig = Partial<Omit<ModelConfig, "key">> & { key?: string | undefined };

export interface StandupReport {
  day: ShopDate;
  measured: { lever: LeverId; verdict: string } | null;
  customer: { written: boolean; writer: string | null };
  manager: { written: boolean; writer: string | null; decision: LeverId | null; declined: string | null };
}

/** Every day from `from` to `to`, both included. */
export function daysFrom(from: ShopDate, to: ShopDate): ShopDate[] {
  const out: ShopDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** A change touches the regular's visit when it runs all day, or in the hour they come in. */
const touches = (lever: LeverId, r: Regular) => {
  const h = LEVERS[lever].hours;
  return h === null || (r.hour >= h[0] && r.hour < h[1]);
};

/** The live change's figures as of yesterday: planned (not in yet), or day n with its effect so far. */
async function trialFor(db: Db, live: Experiment, yesterday: ShopDate): Promise<Figure[]> {
  if (live.startsOn > yesterday) return plannedFigures(live.lever, live.startsOn);
  const last = yesterday < live.endsOn ? yesterday : live.endsOn;
  const soFar = await measure(db, live.lever, daysFrom(live.startsOn, last));
  return trialFigures(live.lever, daysFrom(live.startsOn, last).length, TRIAL_DAYS, soFar);
}

/** Step 1: closes the live change if its week is over. Returns the change measured this morning, if any. */
async function measureDue(db: Db, today: ShopDate): Promise<Experiment | null> {
  const all = await allExperiments(db);
  const due = all.find((e) => e.status === "live" && e.endsOn < today);
  if (due) {
    const effect = await measure(db, due.lever, daysFrom(due.startsOn, due.endsOn));
    if (effect) {
      const verdict = verdictOf(effect, due.lever);
      // days already written keep the change; it comes out from the first day the simulator hasn't written
      const until = verdict === "rolled-back" ? addDays(await firstUnwritten(db, today), -1) : null;
      await closeExperiment(db, due.id, { verdict, effect, until, measuredOn: today });
    }
  }
  return (await allExperiments(db)).find((e) => e.measuredOn === today) ?? null;
}

const filled = (body: string, figures: readonly Figure[]) => parts(body, figures).map((p) => (typeof p === "string" ? p : p.display)).join("");

export async function runStandup(db: Db, now: Date, cfg: StandupConfig = {}): Promise<StandupReport> {
  const today = shopToday(now);
  const yesterday = addDays(today, -1);
  const measured = await measureDue(db, today);
  const all = await allExperiments(db);
  const live = all.find((e) => e.status === "live") ?? null;
  const report: StandupReport = {
    day: today,
    measured: measured && { lever: measured.lever, verdict: measured.verdict ?? "" },
    customer: { written: false, writer: null },
    manager: { written: false, writer: null, decision: null, declined: null },
  };

  const existing = await callsOn(db, today);
  if (existing.manager) return report; // this morning's standup has run

  // 2. the regular
  const r = regularFor(today);
  const visit = await visitFigures(db, yesterday, r);
  const trial = live && live.startsOn <= yesterday ? await trialFor(db, live, yesterday) : [];
  let customer: CustomerCall | null = existing.customer;
  if (!customer) {
    const inTrial = live && live.startsOn <= yesterday ? { lever: live.lever, touches: touches(live.lever, r) } : null;
    const figures = inTrial?.touches ? merge(visit.figures, trial) : visit.figures;
    const settled = new Set(all.filter((e) => e.verdict === "kept").map((e) => LEVERS[e.lever].answers));
    const spoken = await speakAsRegular(r, { ...visit, figures }, { trial: inTrial, settled }, cfg);
    const call = { day: today, kind: "customer" as const, speaker: r.id, figures, ...spoken };
    report.customer = { written: await insertCall(db, call), writer: spoken.writer };
    customer = (await callsOn(db, today)).customer;
    if (!customer) throw new Error(`The customer call for ${today} wasn't stored`);
  }

  // 3. the manager
  const heard = new Map<Topic, number>();
  for (const c of await callsSince(db, addDays(today, -13))) if (c.kind === "customer") heard.set(c.payload.topic, (heard.get(c.payload.topic) ?? 0) + 1);
  const startsOn = await firstUnwritten(db, addDays(today, 1));
  const blocked: Partial<Record<LeverId, string>> = {};
  for (const id of LEVER_IDS) {
    const why = unavailable(all, id, today);
    if (why) blocked[id] = why;
  }
  const liveFigures = live ? (live.startsOn > yesterday ? plannedFigures(live.lever, live.startsOn) : trial) : [];
  const decided = await decide(
    {
      heardText: filled(customer.body, customer.figures),
      regularName: r.name,
      topic: customer.payload.topic,
      mood: customer.payload.mood,
      heardLately: [...heard].map(([topic, times]) => ({ topic, times })).sort((a, b) => b.times - a.times),
      live: live?.lever ?? null,
      measured: measured && { lever: measured.lever, kept: measured.verdict === "kept" },
      unavailable: blocked,
      startsOn,
      figures: merge(await dayFigures(db, yesterday), visit.figures, liveFigures, measured?.effect ? verdictFigures(measured.lever, measured.effect, measured.verdict === "kept") : []),
    },
    cfg,
  );

  // 4. the plan: the change goes on the board before the call that announces it is stored
  const lever = decided.payload.decision;
  if (lever) {
    const started = await startExperiment(db, { lever, heard: customer.payload.topic, proposedOn: today, startsOn, endsOn: trialEnd(startsOn) });
    if (!started) throw new Error(`Another change went live while ${today}'s standup ran; run it again`);
  }
  const call = { day: today, kind: "manager" as const, speaker: "manager", body: decided.body, figures: decided.figures, payload: decided.payload, writer: decided.writer, refused: decided.refused, guarded: decided.guarded };
  report.manager = { written: await insertCall(db, call), writer: decided.writer, decision: lever, declined: decided.payload.declined?.reason ?? null };
  return report;
}
