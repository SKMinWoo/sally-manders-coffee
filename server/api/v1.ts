// The read-only API's handlers, as plain functions of a database and an instant, so the contract
// tests call exactly what the routes call. The route files in app/api/v1 only adapt these.

import type { z } from "zod";
import { isShopDate, shopToday, type ShopDate } from "@/lib/time";
import type { Db } from "@/server/db/client";
import { listMenu } from "@/server/db/repositories/menu";
import { daySummary, itemsSold, ordersByHour } from "@/server/db/repositories/metrics";
import { writtenDays } from "@/server/db/repositories/orders";
import { daysAhead } from "@/server/sim/run";
import { DayHours, DayItems, DaySummary, Health, Menu, Problem } from "./schemas";

export type ApiResult = { status: number; body: unknown; cache: "public" | "none" };

const ok = <S extends z.ZodType>(schema: S, body: z.input<S>, cache: ApiResult["cache"] = "public"): ApiResult => ({
  status: 200,
  body: schema.parse(body), // a response that breaks the contract fails here, loudly, not in a client
  cache,
});

export const problem = (status: number, title: string, detail?: string): ApiResult => ({
  status,
  body: Problem.parse({ type: "about:blank", title, status, detail }),
  cache: "none",
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
    waitP50Seconds: s.waitP50,
    waitP95Seconds: s.waitP95,
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
