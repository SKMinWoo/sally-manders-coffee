import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { brief } from "@/server/api/v1";

export const GET = () => handle(async () => brief(await shopDb()));
