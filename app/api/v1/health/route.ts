import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { health } from "@/server/api/v1";

export const GET = () => handle(async () => health(await shopDb(), new Date()));
