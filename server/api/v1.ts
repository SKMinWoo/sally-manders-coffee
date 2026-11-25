// The read-only API's handlers, as plain functions of a database and an instant, so the contract
// tests call exactly what the routes call. The route files in app/api/v1 only adapt these.

import type { z } from "zod";
import { isShopDate, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { listMenu } from "@/server/menu";
import { daySummary, itemsSold, ordersByHour } from "@/server/reporting";
import { daysAhead, writtenDays } from "@/server/simulator";
import { engineering as engineeringReport } from "@/server/office";
import { latestBrief, parts } from "@/server/brief";
import { problem, type ApiResult } from "@/server/platform/http";
import { listFootfall } from "@/server/orders";
import { boardView, type Arm, type Call, type Card, type Morning } from "@/server/board";
import { Board, BoardArm, BoardCall, BoardCard, Brief, DayHours, DayItems, DaySummary, Engineering, Footfall, Health, Menu } from "./schemas";

// the routes and tests have always imported these from here
export { problem, type ApiResult };

const ok = <S extends z.ZodType>(schema: S, body: z.input<S>, cache: ApiResult["cache"] = "public"): ApiResult => ({
  status: 200,
  body: schema.parse(body), // a response that breaks the contract fails here, loudly, not in a client
  cache,
});

/** "today" or a date, checked: a malformed date is a 400, a day that hasn't come yet a 404. */
function resolveDay(param: string, now: Date): ShopDate | ApiResult {
  const today = shopToday(now);
  const date = param === "today" ? today : param;
  if (!isShopDate(date)) return problem(400, "Not a date", `Expected YYYY-MM-DD or "today", got "${param.slice(0, 40)}"`);
  if (date > today) return problem(404, "That day hasn't happened yet", `The shop's today is ${today}, in Austin`);
  return date;
}

/** `commit` is the build's own commit on Vercel, which the deploy watches for (scripts/deploy/ship.mjs). */
export async function health(db: Db, now: Date, commit: string | null = process.env.VERCEL_GIT_COMMIT_SHA || null): Promise<ApiResult> {
  const ahead = daysAhead(now);
  const have = await writtenDays(db, ahead);
  const simulatorAhead = ahead.every((d) => have.has(d));
  return ok(Health, { status: simulatorAhead ? "ok" : "degraded", time: now.toISOString(), today: ahead[0]!, simulatorAhead, commit }, "none");
}

export async function menu(db: Db): Promise<ApiResult> {
  const items = await listMenu(db);
  return ok(Menu, { items: items.map(({ id, name, group, priceCents, note }) => ({ id, name, group, priceCents, note })) });
}

export async function day(db: Db, param: string, now: Date): Promise<ApiResult> {
  const date = resolveDay(param, now);
  if (typeof date !== "string") return date;
  const s = await daySummary(db, date, now);
  return ok(DaySummary, {
    date,
    asOf: now.toISOString(),
    orders: s.orders,
    visitorOrders: s.visitorOrders,
    salesCents: s.salesCents,
    taxCents: s.taxCents,
    averageCheckCents: s.orders ? Math.round(s.salesCents / s.orders) : null,
    waitP50Seconds: s.waitP50 === null ? null : Math.round(s.waitP50),
    waitP95Seconds: s.waitP95 === null ? null : Math.round(s.waitP95),
  });
}

export async function dayHours(db: Db, param: string, now: Date): Promise<ApiResult> {
  const date = resolveDay(param, now);
  if (typeof date !== "string") return date;
  return ok(DayHours, { date, asOf: now.toISOString(), hours: await ordersByHour(db, date, now) });
}

export async function dayItems(db: Db, param: string, now: Date): Promise<ApiResult> {
  const date = resolveDay(param, now);
  if (typeof date !== "string") return date;
  return ok(DayItems, { date, asOf: now.toISOString(), items: await itemsSold(db, date, now) });
}

/** How far back footfall reaches: longer than any wait the simulator writes, so everyone still waiting is in it. */
export const FOOTFALL_WINDOW_MS = 15 * 60_000;

/**
 * Guests through the door: orders placed after `since` (at most 15 minutes back; the default) and
 * up to now. The home page walks them across the model and polls with the last `asOf` as `since`.
 */
export async function footfall(db: Db, since: string | null, now: Date): Promise<ApiResult> {
  const floor = now.getTime() - FOOTFALL_WINDOW_MS;
  let from = floor;
  if (since !== null) {
    const t = Date.parse(since);
    if (Number.isNaN(t)) return problem(400, "Not a time", `Expected an ISO 8601 instant, got "${since.slice(0, 40)}"`);
    from = Math.min(Math.max(t, floor), now.getTime());
  }
  const guests = await listFootfall(db, new Date(from), now);
  return ok(
    Footfall,
    {
      since: new Date(from).toISOString(),
      asOf: now.toISOString(),
      guests: guests.map((g) => ({ placedAt: g.placedAt.toISOString(), readyAt: g.readyAt.toISOString(), items: g.items, source: g.source })),
    },
    "none", // each poll asks from its own instant, so an edge cache would only hold stale doors
  );
}

/** Each résumé claim, its twin here, and the figures the twin has measured (the back office, as data). */
export async function engineering(db: Db, now: Date): Promise<ApiResult> {
  return ok(Engineering, await engineeringReport(db, now));
}

const arm = (a: Arm): z.input<typeof BoardArm> => ({
  orders: a.orders,
  takingsCents: a.takingsCents,
  waitP50Seconds: a.waitP50,
  waitP90Seconds: a.waitP90,
  hoursWaitP50Seconds: a.hoursWaitP50,
  hoursWaitP90Seconds: a.hoursWaitP90,
  staffHours: a.staffHours,
});

const boardCard = (c: Card): z.input<typeof BoardCard> => ({
  ...c,
  effect: c.effect && { from: c.effect.from, to: c.effect.to, days: c.effect.days, with: arm(c.effect.with), without: arm(c.effect.without) },
  change: c.deltas,
});

const boardCall = (c: Call, speaker: string): z.input<typeof BoardCall> => ({
  day: c.day,
  kind: c.kind,
  speaker,
  text: parts(c.body, c.figures).map((p) => (typeof p === "string" ? p : p.display)).join(""),
  template: c.body,
  figures: c.figures,
  writer: c.writer,
  refused: c.refused,
  guarded: c.guarded,
  topic: c.kind === "customer" ? c.payload.topic : null,
  mood: c.kind === "customer" ? c.payload.mood : null,
  decision: c.kind === "manager" ? c.payload.decision : null,
  declined: c.kind === "manager" ? c.payload.declined : null,
});

const morning = (m: Morning) => ({
  day: m.day,
  customer: m.customer && boardCall(m.customer, m.customer.speakerName),
  manager: m.manager && boardCall(m.manager, "The manager"),
  heldFor: m.heldFor,
});

/** The board: the morning calls, what's been heard, the change planned or being tried, and what was measured and kept. */
export async function board(db: Db, now: Date): Promise<ApiResult> {
  const b = await boardView(db, now);
  return ok(Board, {
    today: b.today,
    asOf: now.toISOString(),
    latest: b.latest && morning(b.latest),
    log: b.log.map(morning),
    heard: b.heard.map((h) => ({ topic: h.topic, label: h.label, times: h.times, latestDay: h.latest.day, latestSpeaker: h.latest.speaker })),
    planned: b.planned && boardCard(b.planned),
    trying: b.trying && boardCard(b.trying),
    next: b.next,
    measured: b.measured.map(boardCard),
    standing: b.standing.map((k) => ({ lever: k.lever, name: k.name, since: k.since, proposedOn: k.proposedOn, heard: k.heard, change: k.deltas })),
    counts: b.counts,
  });
}

/** The newest manager's brief: the note on the last complete day, and every figure it uses. */
export async function brief(db: Db): Promise<ApiResult> {
  const b = await latestBrief(db);
  if (!b) return problem(404, "No brief yet", "The first is written by the daily job, the morning after the first full day");
  const text = parts(b.body, b.figures).map((p) => (typeof p === "string" ? p : p.display)).join("");
  return ok(Brief, {
    date: b.day,
    writtenAt: b.writtenAt,
    writer: b.writer,
    refused: b.refused,
    guarded: b.guarded,
    text,
    template: b.body,
    figures: b.figures,
  });
}
