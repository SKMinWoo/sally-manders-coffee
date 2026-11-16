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
import { Brief, DayHours, DayItems, DaySummary, Engineering, Health, Menu } from "./schemas";

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

export async function health(db: Db, now: Date): Promise<ApiResult> {
  const ahead = daysAhead(now);
  const have = await writtenDays(db, ahead);
  const simulatorAhead = ahead.every((d) => have.has(d));
  return ok(Health, { status: simulatorAhead ? "ok" : "degraded", time: now.toISOString(), today: ahead[0]!, simulatorAhead }, "none");
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

/** Each résumé claim, its twin here, and the figures the twin has measured (the back office, as data). */
export async function engineering(db: Db, now: Date): Promise<ApiResult> {
  return ok(Engineering, await engineeringReport(db, now));
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
