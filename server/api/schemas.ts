// The read-only API's contract. Each response is parsed through its schema before it is sent,
// the contract tests parse every response again, and /api/v1/openapi.json is generated from these
// same objects, so the documentation can't drift from what the endpoints return.

import { z } from "zod";

const ShopDate = z.iso.date().describe("An Austin calendar date (America/Chicago), YYYY-MM-DD");
const Cents = z.int().nonnegative().describe("Whole US cents");
const Seconds = z.number().int().nonnegative().describe("Whole seconds, placed to ready (rounded)");

export const Health = z
  .object({
    status: z.enum(["ok", "degraded"]),
    time: z.iso.datetime({ offset: true }),
    today: ShopDate,
    simulatorAhead: z.boolean().describe("Whether today and tomorrow are both written; false means the daily job missed"),
  })
  .meta({ id: "Health" });

export const MenuItem = z
  .object({
    id: z.string(),
    name: z.string(),
    group: z.enum(["bar", "brewed", "not-coffee", "food"]),
    priceCents: Cents,
    note: z.string().nullable(),
  })
  .meta({ id: "MenuItem" });

export const Menu = z.object({ items: z.array(MenuItem) }).meta({ id: "Menu" });

const SoFar = {
  date: ShopDate,
  asOf: z.iso.datetime({ offset: true }).describe("Figures count orders placed up to this instant"),
};

export const DaySummary = z
  .object({
    ...SoFar,
    orders: z.int().nonnegative(),
    visitorOrders: z.int().nonnegative().describe("Orders placed by visitors on the site; the rest are simulated"),
    salesCents: Cents.describe("Net sales before tax"),
    taxCents: Cents,
    averageCheckCents: Cents.nullable(),
    waitP50Seconds: Seconds.nullable(),
    waitP95Seconds: Seconds.nullable(),
  })
  .meta({ id: "DaySummary" });

export const HourCount = z
  .object({ hour: z.int().min(0).max(23), orders: z.int().nonnegative(), salesCents: Cents })
  .meta({ id: "HourCount" });

export const DayHours = z.object({ ...SoFar, hours: z.array(HourCount) }).meta({ id: "DayHours" });

export const ItemSold = z
  .object({ itemId: z.string(), name: z.string(), qty: z.int().positive(), salesCents: Cents })
  .meta({ id: "ItemSold" });

export const DayItems = z.object({ ...SoFar, items: z.array(ItemSold) }).meta({ id: "DayItems" });

export const Figure = z
  .object({
    label: z.string(),
    display: z.string().describe("The figure as the back office prints it"),
    value: z.number(),
    source: z.enum(["live", "ci"]).describe("live: counted at request time; ci: measured by the linked GitHub Actions run"),
    measuredAt: z.iso.datetime({ offset: true }),
    runUrl: z.url().nullable(),
    sha: z.string().regex(/^[0-9a-f]{40}$/).nullable(),
  })
  .meta({ id: "Figure" });

export const Claim = z
  .object({
    id: z.string(),
    role: z.enum(["Full-Stack Software Engineer", "Software Development Engineer in Test"]),
    gm: z.string().describe("The General Motors résumé bullet, word for word; **bold** marks its headline figure"),
    twin: z.string().describe("What Sally Mander's runs in its place"),
    exhibit: z.int().positive(),
    status: z.enum(["running", "coming"]),
    code: z.array(z.object({ label: z.string(), url: z.url() })),
    figures: z.array(Figure).describe("Empty until the twin has measured something"),
  })
  .meta({ id: "Claim" });

export const Engineering = z
  .object({ asOf: z.iso.datetime({ offset: true }), claims: z.array(Claim) })
  .meta({ id: "Engineering" });

/** RFC 9457 problem details. */
export const Problem = z
  .object({ type: z.string(), title: z.string(), status: z.int(), detail: z.string().optional() })
  .meta({ id: "Problem" });
