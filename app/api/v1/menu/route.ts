import { shopDb } from "@/server/db/client";
import { handle } from "@/server/api/respond";
import { menu } from "@/server/api/v1";

export const GET = () => handle(async () => menu(await shopDb()));
