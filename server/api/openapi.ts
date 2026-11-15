// The OpenAPI 3.1 document, generated from the same zod schemas the handlers parse their
// responses through. OpenAPI 3.1's schema dialect is JSON Schema 2020-12, zod 4's default.

import { z } from "zod";
import { DayHours, DayItems, DaySummary, Health, HourCount, ItemSold, Menu, MenuItem, Problem } from "./schemas";

const SCHEMAS = { Health, MenuItem, Menu, DaySummary, HourCount, DayHours, ItemSold, DayItems, Problem };

function components() {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(SCHEMAS)) registry.add(schema, { id });
  const { schemas } = z.toJSONSchema(registry, { uri: (id) => `#/components/schemas/${id}` });
  // each component names its dialect and id; inside an OpenAPI document the document does that
  return Object.fromEntries(
    Object.entries(schemas).map(([id, s]) => {
      const { $schema: _dialect, $id: _id, ...rest } = s as Record<string, unknown>;
      return [id, rest];
    }),
  );
}

const ref = (id: keyof typeof SCHEMAS) => ({ $ref: `#/components/schemas/${id}` });
const json = (id: keyof typeof SCHEMAS, description: string) => ({ description, content: { "application/json": { schema: ref(id) } } });
const problem = (description: string) => ({ description, content: { "application/problem+json": { schema: ref("Problem") } } });

const dateParam = {
  name: "date",
  in: "path",
  required: true,
  description: 'An Austin date, YYYY-MM-DD, or "today"',
  schema: { type: "string", examples: ["today", "2026-11-13"] },
};
const dayErrors = { "400": problem("Not a date"), "404": problem("A day that hasn't happened yet") };
const SO_FAR = "Counts only orders placed up to the moment of the request: the simulator writes days ahead, and nothing is counted before its time.";

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Sally Mander's API",
      version: "1.0.0",
      description:
        "Read-only figures from Sally Mander's, a simulated coffee shop in South Austin that never closes. Money is in whole cents; days are Austin calendar days. Responses are cached at the edge for a minute.",
    },
    servers: [{ url: "/api/v1" }],
    paths: {
      "/health": { get: { summary: "Is the shop up, and is the simulator a day ahead?", responses: { "200": json("Health", "Health") } } },
      "/menu": { get: { summary: "Today's board", responses: { "200": json("Menu", "The menu, in board order") } } },
      "/days/{date}": {
        get: { summary: "A day's summary, so far", description: SO_FAR, parameters: [dateParam], responses: { "200": json("DaySummary", "Summary"), ...dayErrors } },
      },
      "/days/{date}/hours": {
        get: { summary: "Orders by Austin hour, so far", description: SO_FAR, parameters: [dateParam], responses: { "200": json("DayHours", "Hours with orders"), ...dayErrors } },
      },
      "/days/{date}/items": {
        get: { summary: "Items sold, most first, so far", description: SO_FAR, parameters: [dateParam], responses: { "200": json("DayItems", "Items"), ...dayErrors } },
      },
    },
    components: { schemas: components() },
  };
}
