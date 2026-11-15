import { openApiDocument } from "@/server/api/openapi";

// Generated from the zod schemas at build time; it only changes when the code does.
export const dynamic = "force-static";

export const GET = () => Response.json(openApiDocument(), { headers: { "Access-Control-Allow-Origin": "*" } });
