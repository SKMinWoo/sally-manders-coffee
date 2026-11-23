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
  .object({ hour: z.int().min(0).max(23), orders: z.int().nonnegative(), salesCents: Cents, waitP50Seconds: Seconds.describe("The hour's typical wait (the median), placed to ready") })
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
    gm: z.string().describe("The General Motors résumé bullet, word for word; **bold** marks the part this twin answers"),
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

export const Guest = z
  .object({
    placedAt: z.iso.datetime({ offset: true }),
    readyAt: z.iso.datetime({ offset: true }).describe("When the cup was up: the guest leaves then"),
    items: z.int().positive(),
    source: z.enum(["sim", "visitor"]).describe("sim: written by the simulator; visitor: a real order from /order"),
  })
  .meta({ id: "Guest" });

export const Footfall = z
  .object({
    since: z.iso.datetime({ offset: true }).describe("Orders placed after this instant (never more than 15 minutes back)"),
    asOf: z.iso.datetime({ offset: true }).describe("…and up to this one; send it back as since to get only what's new"),
    guests: z.array(Guest).describe("Oldest first, with no ids, lines or anything about the visitor"),
  })
  .meta({ id: "Footfall" });

export const BriefFigure = z
  .object({
    key: z.string().regex(/^[A-Za-z]+$/).describe("Where the figure goes in template, as {key}"),
    label: z.string(),
    display: z.string().describe("The figure as the brief prints it"),
    source: z.string().startsWith("/api/v1/").describe("The API path it comes from"),
  })
  .meta({ id: "BriefFigure" });

export const Brief = z
  .object({
    date: ShopDate.describe("The complete Austin day the brief is about"),
    writtenAt: z.iso.datetime({ offset: true }),
    writer: z.string().describe('The model that wrote it, or "template" when none did'),
    refused: z.string().nullable().describe("Why the model's draft wasn't kept, if it wasn't; the template was used instead"),
    guarded: z.boolean().describe("Whether the guard turned the draft back for writing a number itself"),
    text: z.string().describe("The brief, figures filled in"),
    template: z.string().describe("The brief as written, with {key} where each figure goes; no number in it is the writer's"),
    figures: z.array(BriefFigure),
  })
  .meta({ id: "Brief" });

export const BoardCall = z
  .object({
    day: ShopDate.describe("The morning of the call; it talks about the day before"),
    kind: z.enum(["customer", "manager"]),
    speaker: z.string().describe("The regular's name, or the manager"),
    text: z.string().describe("The call, figures filled in"),
    template: z.string().describe("The call as written, with {key} where each figure goes; no number in it is the writer's"),
    figures: z.array(BriefFigure),
    writer: z.string().describe('The model that wrote it, or "template" when none did'),
    refused: z.string().nullable().describe("Why the model's draft wasn't kept, if it wasn't"),
    guarded: z.boolean().describe("Whether the guard turned the draft back for writing a number itself"),
    topic: z.string().nullable().describe("The customer's call only: what they raised"),
    mood: z.enum(["pleased", "mixed", "let down"]).nullable().describe("The customer's call only"),
    decision: z.string().nullable().describe('The manager\'s call only: the lever chosen, or null to hold'),
    declined: z.object({ asked: z.string(), reason: z.string() }).nullable().describe("The manager's call only: a lever asked for and turned down by the repository, and why"),
  })
  .meta({ id: "BoardCall" });

const BoardMorning = z.object({
  day: ShopDate,
  customer: BoardCall.nullable(),
  manager: BoardCall.nullable(),
  heldFor: z.string().nullable().describe("When the manager held: the change already chosen and still running that morning"),
});

export const BoardArm = z
  .object({
    orders: z.int().nonnegative(),
    takingsCents: Cents,
    waitP50Seconds: Seconds,
    waitP90Seconds: Seconds,
    hoursWaitP50Seconds: Seconds.nullable().describe("In the hours the lever touches, when it touches only some"),
    hoursWaitP90Seconds: Seconds.nullable(),
    staffHours: z.number().nonnegative().describe("Barista hours over the days measured"),
  })
  .meta({ id: "BoardArm" });

export const BoardCard = z
  .object({
    id: z.int().positive(),
    lever: z.string(),
    name: z.string(),
    what: z.string(),
    cost: z.string(),
    answers: z.string().describe("What the change is meant to answer"),
    heard: z.string().describe("What the regular had raised the morning it was chosen"),
    proposedOn: ShopDate,
    startsOn: ShopDate,
    endsOn: ShopDate,
    day: z.int().positive().nullable().describe("Trying only: the day of its week today is"),
    verdict: z.enum(["kept", "rolled-back"]).nullable(),
    measuredOn: ShopDate.nullable(),
    effect: z
      .object({ from: ShopDate, to: ShopDate, days: z.int().positive(), with: BoardArm, without: BoardArm })
      .nullable()
      .describe("The days it ran (so far, while trying), against the same days replayed by the simulator without it"),
    change: z
      .object({ wait: z.number(), slow: z.number(), orders: z.number(), takings: z.number(), staffHoursPerDay: z.number() })
      .nullable()
      .describe("The effect as fractions of the week without it (-0.08 is 8% lower), and extra barista hours a day"),
  })
  .meta({ id: "BoardCard" });

export const Board = z
  .object({
    today: ShopDate,
    asOf: z.iso.datetime({ offset: true }),
    latest: BoardMorning.nullable().describe("The newest morning's calls"),
    log: z.array(BoardMorning).describe("The mornings before it, newest first, over the last four weeks"),
    heard: z.array(z.object({ topic: z.string(), label: z.string(), times: z.int().positive(), latestDay: ShopDate, latestSpeaker: z.string() })),
    planned: BoardCard.nullable(),
    trying: BoardCard.nullable(),
    next: z
      .object({ on: ShopDate, open: z.array(z.object({ lever: z.string(), name: z.string() })) })
      .nullable()
      .describe("While a change is on trial: the morning the next is chosen, and the levers the repository would allow then"),
    measured: z.array(BoardCard).describe("Newest first"),
    standing: z
      .array(
        z.object({
          lever: z.string(),
          name: z.string(),
          since: ShopDate,
          proposedOn: ShopDate.describe("The morning the manager chose it"),
          heard: z.string().describe("What the regular had raised that morning"),
          change: BoardCard.shape.change,
        }),
      )
      .describe("The changes kept, oldest first, each with what its week showed"),
    counts: z.object({ tried: z.int().nonnegative(), kept: z.int().nonnegative(), since: ShopDate.nullable() }),
  })
  .meta({ id: "Board" });

// RFC 9457 problem details: defined with the results every module returns, listed here with the rest
export { Problem } from "@/server/platform/http";
