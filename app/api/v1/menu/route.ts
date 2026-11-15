import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { menu } from "@/server/api/v1";

export const GET = () => handle(async () => menu(await shopDb()));
