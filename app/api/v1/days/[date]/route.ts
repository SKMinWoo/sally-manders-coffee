import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { day } from "@/server/api/v1";

export const GET = (_req: Request, ctx: { params: Promise<{ date: string }> }) =>
  handle(async () => day(await shopDb(), (await ctx.params).date, new Date()));
