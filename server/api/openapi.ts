// The OpenAPI 3.1 document, generated from the same zod schemas the handlers parse their
// responses through. OpenAPI 3.1's schema dialect is JSON Schema 2020-12, zod 4's default.

import { z } from "zod";
import { Brief, BriefFigure, Claim, DayHours, DayItems, DaySummary, Engineering, Figure, Footfall, Guest, Health, HourCount, ItemSold, Menu, MenuItem, Problem } from "./schemas";

const SCHEMAS = { Health, MenuItem, Menu, DaySummary, HourCount, DayHours, ItemSold, DayItems, Guest, Footfall, BriefFigure, Brief, Figure, Claim, Engineering, Problem };

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
      "/footfall": {
        get: {
          summary: "Guests through the door in the last quarter hour",
          description:
            "Each order placed after since and up to now, as a guest: when they ordered, when the cup was up, and how many items. Nothing identifies an order or a visitor. Poll with the last asOf as since to get only what's new. Never cached.",
          parameters: [
            { name: "since", in: "query", required: false, description: "An ISO 8601 instant; clamped to the last 15 minutes (the default)", schema: { type: "string", format: "date-time" } },
          ],
          responses: { "200": json("Footfall", "The guests, oldest first"), "400": problem("since isn't a time") },
        },
      },
      "/exports/sales": {
        get: {
          summary: "Every order line over a span of Austin days, as an Excel workbook",
          description:
            "Streamed as it is read, so its size doesn't depend on memory. Refused with 409 if any check in the span doesn't add up. Send back the ETag as If-None-Match and a repeat with nothing new is a 304; a HEAD answers the same way without the workbook.",
          parameters: [
            { name: "from", in: "query", required: false, description: "First Austin day, YYYY-MM-DD (default: 27 days before to)", schema: { type: "string", format: "date" } },
            { name: "to", in: "query", required: false, description: "Last Austin day, no later than today (default: today); at most 92 days in all", schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": { description: "The workbook: a Sales sheet and a Totals sheet", content: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { schema: { type: "string", contentMediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } } } },
            "304": { description: "Nothing changed since the workbook whose ETag was sent" },
            "400": problem("Not a span the export takes"),
            "409": problem("A check in the span doesn't add up, so nothing was exported"),
          },
        },
      },
      "/brief": {
        get: {
          summary: "The manager's brief on the last complete day",
          description:
            "A few sentences written each morning by a model, or by a template when no model is set up or its draft was turned back. The writer puts {key} where a figure goes and the figures are filled in from the database, so no number in the brief is the writer's own: a draft that writes one is turned back by the guard.",
          responses: { "200": json("Brief", "The brief, and every figure it uses with its source"), "404": problem("No brief written yet") },
        },
      },
      "/engineering": {
        get: {
          summary: "Each résumé claim, its twin here, and what the twin has measured",
          description: "The back office (/office) as data. Live figures are counted at request time; the rest were posted by a GitHub Actions run on main, which each figure links to.",
          responses: { "200": json("Engineering", "The claims, in résumé order") },
        },
      },
    },
    components: { schemas: components() },
  };
}
