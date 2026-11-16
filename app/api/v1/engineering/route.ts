import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { engineering } from "@/server/api/v1";
import { now } from "@/server/platform/clock";

export const GET = () => handle(async () => engineering(await shopDb(), now()));
