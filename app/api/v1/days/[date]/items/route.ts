import { shopDb } from "@/server/db/client";
import { handle } from "@/server/api/respond";
import { dayItems } from "@/server/api/v1";

export const GET = (_req: Request, ctx: { params: Promise<{ date: string }> }) =>
  handle(async () => dayItems(await shopDb(), (await ctx.params).date, new Date()));
