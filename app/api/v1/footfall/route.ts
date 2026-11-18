import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { footfall } from "@/server/api/v1";
import { now } from "@/server/platform/clock";

export const GET = (req: Request) => handle(async () => footfall(await shopDb(), new URL(req.url).searchParams.get("since"), now()));
