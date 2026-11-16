import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { dayItems } from "@/server/api/v1";
import { now } from "@/server/platform/clock";

export const GET = (_req: Request, ctx: { params: Promise<{ date: string }> }) =>
  handle(async () => dayItems(await shopDb(), (await ctx.params).date, now()));
