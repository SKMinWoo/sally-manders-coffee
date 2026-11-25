// The manager's call: the reply to the regular, and the one decision of the morning, to hold or to
// try a change from the catalogue. The model may propose; the repository decides. A lever that
// isn't in the catalogue, or can't be tried now (one at a time, nothing already kept, a fortnight's
// rest after a rollback), is turned down and the manager holds. The note passes the brief's guard
// like every other note here; if it doesn't, the template writes one for whatever was decided.

import { z } from "zod";
import { askModel, guard, type ModelConfig } from "@/server/brief";
import { isLeverId, LEVER_IDS, LEVERS, TOPICS, type LeverId, type Topic } from "@/server/simulator";
import type { Figure } from "./figures";
import { BOARD_SOURCE, inProse, weekdayName } from "./figures";
import type { ShopDate } from "@/lib/time";
import type { CustomerCall, ManagerPayload } from "./repository";

export const ManagerReply = z.object({ note: z.string(), decision: z.string() });

export interface Situation {
  /** the regular's call this morning, figures filled in */
  heardText: string;
  regularName: string;
  topic: Topic;
  mood: CustomerCall["payload"]["mood"];
  /** topics heard over the last fortnight, most first */
  heardLately: { topic: Topic; times: number }[];
  /** the change being tried, if one is */
  live: LeverId | null;
  /** a change that ran its week and was measured this morning, if one was */
  measured: { lever: LeverId; kept: boolean } | null;
  /** why each lever can't be tried now; a lever missing here can be */
  unavailable: Partial<Record<LeverId, string>>;
  /** the day a change chosen now would start (the first day not yet written) */
  startsOn: ShopDate;
  /** yesterday's figures, the regular's, the trial's and the verdict's */
  figures: Figure[];
}

const SYSTEM = [
  "You are the manager of Sally Mander's, a coffee shop in South Austin that never closes. You care about the shop growing and about every guest having the best visit the shop can give. The shop is simulated: its orders come from a simulator, and you say nothing that pretends otherwise.",
  "Each morning a regular calls with their thoughts on yesterday, and you reply to the team in two to four plain sentences: answer what the regular said, say what the figures show, and say what happens next. Warm and matter-of-fact; no greeting, no sign-off, no lists, no markdown.",
  "You also decide one thing: hold, or try one change from the list you're given, for a week, from the day you're told. Changes go one at a time: while one is being tried, you hold and say how it's going. Choose the change that best answers what guests have been saying, and say what it costs.",
  "Wherever a figure goes, write its key in braces, exactly as given, for example {orders}; the figures are filled in afterwards. If you choose a change, name it as {chosen} and its first day as {startsOn}.",
  "Never write a number yourself: no digits and no number words (two, half, twice, dozen, percent), not even in a time or a name. If a sentence would need a number you haven't been given, leave it out. Don't explain causes the figures don't show.",
  'Reply with JSON only: {"note": "...", "decision": "hold"} or {"note": "...", "decision": "<the id of one change from the list>"}.',
].join("\n\n");

function prompt(s: Situation): string {
  const figures = s.figures.map((f) => `{${f.key}}: ${f.label} (${f.display})`).join("\n");
  const lately = s.heardLately.map((h) => `${TOPICS[h.topic]}: ${h.times}`).join("; ") || "nothing yet";
  const list = LEVER_IDS.map((id) => {
    const l = LEVERS[id];
    const why = s.unavailable[id];
    return `- ${id}: ${l.name}. ${l.what} Cost: ${l.cost}. Answers: ${TOPICS[l.answers]}.${why ? ` NOT AVAILABLE: ${why}.` : ""}`;
  }).join("\n");
  const status = s.live
    ? `Being tried now: ${LEVERS[s.live].name}. You must hold.`
    : s.measured
      ? `This morning ${LEVERS[s.measured.lever].name} finished its week and was ${s.measured.kept ? "kept" : "taken back"}. Nothing is being tried now.`
      : "Nothing is being tried now.";
  return [
    `This morning ${s.regularName} said (${s.mood}, about ${TOPICS[s.topic]}): "${s.heardText}"`,
    `Heard over the last fortnight: ${lately}.`,
    status,
    `The changes you may choose from:\n${list}`,
    `The figures:\n${figures}`,
    "Write your reply.",
  ].join("\n\n");
}

/** Which lever the template would choose: what the regular raised today, else what's been heard most, else the first free one. */
export function pick(s: Pick<Situation, "topic" | "heardLately" | "unavailable" | "live">): LeverId | null {
  if (s.live) return null;
  const free = LEVER_IDS.filter((id) => !s.unavailable[id]);
  for (const topic of [s.topic, ...s.heardLately.map((h) => h.topic)]) {
    const l = free.find((id) => LEVERS[id].answers === topic);
    if (l) return l;
  }
  return free[0] ?? null;
}

/** The figures a decision adds to the note: the chosen change and the day it starts. */
export function decisionFigures(lever: LeverId, startsOn: ShopDate): Figure[] {
  return [
    { key: "chosen", label: "The change chosen this morning", display: inProse(LEVERS[lever].name), source: BOARD_SOURCE },
    { key: "startsOn", label: "The first day it's in", display: weekdayName(startsOn), source: BOARD_SOURCE },
    { key: "chosenCost", label: "What it costs, or puts at risk", display: LEVERS[lever].cost, source: BOARD_SOURCE },
  ];
}

export function templateManager(s: Situation, decision: LeverId | null): string {
  const has = new Set(s.figures.map((f) => f.key));
  const opener = { pleased: `Glad ${s.regularName}'s visit went well, and I've noted ${TOPICS[s.topic]}.`, "let down": `${s.regularName} is right to raise ${TOPICS[s.topic]}.`, mixed: `Thanks to ${s.regularName} for the word on ${TOPICS[s.topic]}.` };
  const out: string[] = [opener[s.mood]];
  if (s.measured && has.has("measuredName")) out.push("The week of {measuredName} is done: the wait was {measuredWait} and takings {measuredTakings} against the same week without it, so it's {measuredVerdict}.");
  if (has.has("orders") && has.has("takings")) out.push("{weekday} came to {orders} orders and {takings} in takings.");
  if (s.live) {
    if (has.has("trialStarts")) out.push("On {trialStarts} we start {trialName}, and it runs a week from there.");
    else if (has.has("trialWait")) out.push("We're {trialDay} with {trialName}; so far the wait in its hours is {trialWait} and takings {trialTakings}.");
    else if (has.has("trialName")) out.push("We're {trialDay} with {trialName}.");
    out.push("Nothing else changes until its week is out.");
  } else if (decision) {
    out.push("From {startsOn} we're trying {chosen} for a week; what it costs: {chosenCost}.");
  } else {
    out.push("Every change on the list is either part of the shop already or resting after a rollback, so we hold.");
  }
  return out.join(" ");
}

export type Decided = { body: string; payload: ManagerPayload; writer: string; refused: string | null; guarded: boolean; figures: Figure[] };

export async function decide(s: Situation, cfg: Partial<Omit<ModelConfig, "key">> & { key?: string | undefined }): Promise<Decided> {
  let refused: string | null = null;
  let guarded = false;
  let decision: LeverId | null = pick(s);
  let decidedBy = "template";
  let declined: ManagerPayload["declined"] = null;
  let note: string | null = null;
  let writer = "template";

  if (cfg.key) {
    const draft = await askModel(SYSTEM, prompt(s), { ...cfg, key: cfg.key, json: true });
    const reply = draft.ok ? ManagerReply.safeParse(parseReply(draft.text)) : null;
    if (!draft.ok) refused = draft.reason;
    else if (!reply?.success) refused = "its reply wasn't the JSON asked for (a note and a decision)";
    else {
      decidedBy = draft.model;
      const asked = reply.data.decision.trim();
      if (asked === "hold") decision = null;
      else if (!isLeverId(asked)) [decision, declined] = [null, { asked, reason: "it isn't one of the changes on the list" }];
      else if (s.unavailable[asked]) [decision, declined] = [null, { asked, reason: s.unavailable[asked]! }];
      else decision = asked;
      note = reply.data.note;
      writer = draft.model;
    }
  }

  const figures = decision ? [...s.figures, ...decisionFigures(decision, s.startsOn)] : s.figures;
  const keys = new Set(figures.map((f) => f.key));
  if (note !== null) {
    const verdict = guard(note, keys);
    if (verdict.ok) note = verdict.body;
    else [note, refused, guarded, writer] = [null, verdict.reason, true, "template"];
  }
  if (note === null) {
    const t = guard(templateManager(s, decision), keys);
    if (!t.ok) throw new Error(`The manager template broke the guard's rule: ${t.reason}`);
    note = t.body;
  }
  return { body: note, payload: { decision, declined, decidedBy }, writer, refused, guarded, figures };
}

function parseReply(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
}
