// Writing the day's brief, once, after the day is over: the daily job calls this at 3 or 4 am in
// Austin for yesterday. With a model key it asks the model and puts the draft to the guard; with
// no key, or a draft the guard turns back, it writes the template, which the guard checks too.
// A brief already written for that day is left alone, so a second run of the job does nothing.

import { addDays, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { dayFigures, type BriefFigure } from "./figures";
import { guard } from "./guard";
import { askModel, type ModelConfig } from "./model";
import { hasBrief, insertBrief } from "./repository";

export type WriteResult =
  | { day: ShopDate; written: false }
  | { day: ShopDate; written: true; writer: string; refused: string | null; guarded: boolean };

const SYSTEM = [
  "You are the manager of Sally Mander's, a coffee shop in South Austin that never closes. The shop is simulated: its orders come from a simulator, and you say nothing that pretends otherwise.",
  "Each morning you leave the team a short note about yesterday: two to four plain sentences, warm and matter-of-fact, no greeting, no sign-off, no lists, no markdown.",
  "You are given yesterday's figures, each with a key. Wherever a figure goes, write its key in braces, exactly as given, for example {orders}; the figures are filled in afterwards.",
  "Never write a number yourself: no digits and no number words (two, half, twice, dozen, percent), not even in a name or a time. If a sentence would need a number you haven't been given, leave the sentence out.",
  "Don't explain why anything happened (weather, events, staff); you weren't told why. Describe what the figures show, and you needn't use all of them.",
].join("\n");

function prompt(figures: readonly BriefFigure[]): string {
  const lines = figures.map((f) => `{${f.key}}: ${f.label} (${f.display})`);
  return `Yesterday's figures:\n${lines.join("\n")}\n\nWrite the note.`;
}

/** The note when no model writes it: plain, and built only from the figures there are. */
export function template(figures: readonly BriefFigure[]): string {
  const has = new Set(figures.map((f) => f.key));
  const s = [`{weekday} came to {orders} orders and {takings} in takings${has.has("takingsChange") ? ", {takingsChange} on the week before" : ""}.`];
  if (has.has("busiestHour")) s.push("The rush peaked at {busiestHour}, with {busiestHourOrders} orders in the hour.");
  if (has.has("topItem")) s.push("{topItem} sold most, {topItemSold} of them.");
  if (has.has("longestWaits")) s.push("The longest waits ran to {longestWaits}.");
  return s.join(" ");
}

export type BriefConfig = Partial<Omit<ModelConfig, "key">> & { key?: string | undefined };

export async function writeBrief(db: Db, now: Date, cfg: BriefConfig = {}): Promise<WriteResult> {
  const day = addDays(shopToday(now), -1);
  if (await hasBrief(db, day)) return { day, written: false };

  const figures = await dayFigures(db, day);
  const keys = new Set(figures.map((f) => f.key));
  let body: string | null = null;
  let writer = "template";
  let refused: string | null = null;
  let guarded = false;

  if (cfg.key) {
    const draft = await askModel(SYSTEM, prompt(figures), { ...cfg, key: cfg.key });
    const verdict = draft.ok ? guard(draft.text, keys) : { ok: false as const, reason: draft.reason };
    if (verdict.ok) {
      body = verdict.body;
      writer = draft.model;
    } else {
      refused = verdict.reason;
      guarded = draft.ok; // the model answered, and the guard said no
    }
  }
  if (body === null) {
    const t = guard(template(figures), keys);
    if (!t.ok) throw new Error(`The template broke the guard's rule: ${t.reason}`); // a bug here, not a bad day
    body = t.body;
  }

  // two runs at once: the first to arrive keeps the day, the second stores nothing
  const stored = await insertBrief(db, { day, body, figures, writer, refused, guarded });
  return stored ? { day, written: true, writer, refused, guarded } : { day, written: false };
}
