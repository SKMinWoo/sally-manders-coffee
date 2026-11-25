import { shopDb } from "@/server/platform/db/client";
import { handle } from "@/server/platform/http";
import { now } from "@/server/platform/clock";
import { board } from "@/server/api/v1";

export const dynamic = "force-dynamic";

export const GET = () => handle(async () => board(await shopDb(), now()));
