// The customer call: one regular on their visit yesterday. A model speaks as them when there's a
// key; its reply is JSON with a note, the topic they raised and their mood. The topic and mood
// must be from fixed lists, and the note must pass the brief's guard, or the template speaks
// instead, from the same figures.

import { z } from "zod";
import { askModel, guard, type ModelConfig } from "@/server/brief";
import { LEVERS, TOPICS, type LeverId, type Topic } from "@/server/simulator";
import type { Figure, Visit } from "./figures";
import type { Regular } from "./regulars";
import type { CustomerPayload, Mood } from "./repository";

const TOPIC_IDS = Object.keys(TOPICS) as [Topic, ...Topic[]];
const MOODS = ["pleased", "mixed", "let down"] as const satisfies readonly Mood[];

export const CustomerReply = z.object({ note: z.string(), topic: z.enum(TOPIC_IDS), mood: z.enum(MOODS) });

const RULES = [
  "Wherever a figure goes, write its key in braces, exactly as given, for example {waitInHour}; the figures are filled in afterwards.",
  "Never write a number yourself: no digits and no number words (two, half, twice, dozen, percent), not even in a time. If a sentence would need a number you haven't been given, leave it out.",
  "Don't invent reasons the figures don't show (weather, events, staff), and don't describe anything you weren't told.",
].join("\n");

function system(r: Regular): string {
  return [
    `You are ${r.name}, ${r.who}. You are a regular at Sally Mander's, a coffee shop in South Austin that never closes. The shop is simulated, and so are you: you are a character the shop uses to hear how its day went, and you say nothing that pretends otherwise.`,
    "Each morning the manager calls you about your visit yesterday. Answer in the first person, in two or three plain sentences: how the visit went, and the one thing you'd most like the shop to do better. Warm, honest, specific; no greeting, no sign-off, no lists, no markdown.",
    RULES,
    `Reply with JSON only: {"note": "...", "topic": "...", "mood": "..."}. topic is the thing you raised, one of: ${TOPIC_IDS.map((t) => `"${t}" (${TOPICS[t]})`).join(", ")}. mood is one of "pleased", "mixed", "let down".`,
  ].join("\n\n");
}

function prompt(figures: readonly Figure[], trial: LeverId | null): string {
  const lines = figures.map((f) => `{${f.key}}: ${f.label} (${f.display})`);
  const tried = trial ? `\n\nThis week the shop is trying a change: ${LEVERS[trial].what} If you noticed it in your hour, say so.` : "";
  return `Your visit yesterday, as the shop's figures show it:\n${lines.join("\n")}${tried}\n\nWrite your answer.`;
}

/** What a regular would bring up first, when the template has to say it for them. */
const WISH: Record<Topic, string> = {
  line: "If the morning line moved faster I'd stop worrying about it on the way in.",
  wait: "My drink could come up a little quicker; that's the one thing.",
  pickup: "When I order ahead I'm never sure which cup on the bar is mine.",
  food: "I'd have taken something from the warmer if anyone had asked.",
  afternoon: "It was quiet; I like that, but I'd worry for the place if it stays that way.",
  evening: "In the evenings there's one person on the bar, and it shows when a few of us come in at once.",
};

/** What the regular hears about the shop besides their visit: the change being tried, and the topics kept changes have answered. */
export interface Context {
  trial: { lever: LeverId; touches: boolean } | null;
  settled: ReadonlySet<Topic>;
}

/**
 * The note when no model writes it: plain, from the figures, and judged by a simple rule. The
 * topic is what they'd like done next, so a regular who noticed this week's change, or whose
 * first care a kept change already answered, moves on to their other one.
 */
export function templateCustomer(r: Regular, v: Visit, { trial, settled }: Context): { note: string } & CustomerPayload {
  const has = new Set(v.figures.map((f) => f.key));
  const visit = has.has("waitInHour") ? "I came in at {visitHour} for my usual {usual}, and it was up in {waitInHour}." : "I came in at {visitHour} for my usual {usual}.";
  const trying = trial?.touches ? LEVERS[trial.lever].answers : null;
  const next = r.cares.find((c) => c !== trying && !settled.has(c)) ?? r.cares.find((c) => c !== trying) ?? r.cares[0];
  if (trial?.touches && has.has("trialWait")) {
    return { note: `${visit} I noticed {trialName}; so far the wait in those hours is {trialWait}. ${WISH[next]}`, topic: next, mood: "pleased" };
  }
  const slow = v.waitInHour !== null && v.typicalWait !== null && v.waitInHour > v.typicalWait * 1.2;
  if (slow && has.has("typicalWait")) {
    const topic: Topic = r.cares.includes("line") && !settled.has("line") ? "line" : "wait";
    return { note: `${visit} That's slower than the day's typical {typicalWait}, with {ordersInHour} orders in the hour. ${WISH[topic]}`, topic, mood: "let down" };
  }
  return { note: `${visit} ${WISH[next]}`, topic: next, mood: "mixed" };
}

export type Spoken = { body: string; payload: CustomerPayload; writer: string; refused: string | null; guarded: boolean };

/** A model's reply as JSON, forgiving the code fence some models wrap it in. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
}

export async function speakAsRegular(
  r: Regular,
  v: Visit,
  ctx: Context,
  cfg: Partial<Omit<ModelConfig, "key">> & { key?: string | undefined },
): Promise<Spoken> {
  const keys = new Set(v.figures.map((f) => f.key));
  let refused: string | null = null;
  let guarded = false;
  if (cfg.key) {
    const draft = await askModel(system(r), prompt(v.figures, ctx.trial?.touches ? ctx.trial.lever : null), { ...cfg, key: cfg.key, json: true });
    if (!draft.ok) refused = draft.reason;
    else {
      const reply = CustomerReply.safeParse(parseJson(draft.text));
      if (!reply.success) refused = "its reply wasn't the JSON asked for (a note, a topic and a mood from the lists)";
      else {
        const verdict = guard(reply.data.note, keys);
        if (verdict.ok) return { body: verdict.body, payload: { topic: reply.data.topic, mood: reply.data.mood }, writer: draft.model, refused: null, guarded: false };
        refused = verdict.reason;
        guarded = true;
      }
    }
  }
  const t = templateCustomer(r, v, ctx);
  const checked = guard(t.note, keys);
  if (!checked.ok) throw new Error(`The customer template broke the guard's rule: ${checked.reason}`);
  return { body: checked.body, payload: { topic: t.topic, mood: t.mood }, writer: "template", refused, guarded };
}
