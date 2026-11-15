import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { engineering } from "@/server/api/v1";

export const GET = () => handle(async () => engineering(await shopDb(), new Date()));
