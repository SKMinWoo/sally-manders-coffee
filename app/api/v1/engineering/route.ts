import { shopDb } from "@/server/db/client";
import { handle } from "@/server/api/respond";
import { engineering } from "@/server/api/v1";

export const GET = () => handle(async () => engineering(await shopDb(), new Date()));
