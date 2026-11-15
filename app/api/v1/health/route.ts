import { shopDb } from "@/server/db/client";
import { handle } from "@/server/api/respond";
import { health } from "@/server/api/v1";

export const GET = () => handle(async () => health(await shopDb(), new Date()));
