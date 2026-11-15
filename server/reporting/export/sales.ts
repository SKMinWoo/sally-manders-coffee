// "Export sales": every order line over a span of Austin days as an .xlsx, streamed from the
// database to the visitor a page at a time. Before a byte is sent, the span is checked (every
// check's lines must add up to its subtotal) and compared with what the visitor already has.

import { addDays, isShopDate, shopToday } from "@/lib/time";
import type { Db } from "@/server/platform/db/client";
import { saleLines, spanStats, type Span, type SpanStats } from "../sales";
import { isNothingNew as defaultNothingNew, marksIn, tagFor, type ExportMark } from "./nothing-new";
import { workbook, type Cell, type Sheet } from "./xlsx";

export const MAX_DAYS = 92;
export const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type ExportResult =
  | { kind: "problem"; status: 400 | 409; title: string; detail: string }
  | { kind: "unchanged"; tag: string; stats: SpanStats }
  | { kind: "workbook"; tag: string; stats: SpanStats; filename: string; body: () => AsyncGenerator<Uint8Array> };

/** The span a request asks for, checked: real dates, in order, no later than today, at most MAX_DAYS. */
export function parseSpan(from: string | null, to: string | null, now: Date): { span: Span } | { title: string; detail: string } {
  const today = shopToday(now);
  const f = from ?? addDays(today, -27);
  const t = to ?? today;
  if (!isShopDate(f) || !isShopDate(t)) return { title: "Not a date", detail: "from and to are Austin dates, YYYY-MM-DD" };
  if (f > t) return { title: "The span runs backwards", detail: `from (${f}) is after to (${t})` };
  if (t > today) return { title: "That day hasn't happened yet", detail: `The shop's today is ${today}, in Austin` };
  const days = Math.round((Date.parse(t) - Date.parse(f)) / 86_400_000) + 1;
  if (days > MAX_DAYS) return { title: "Too long a span", detail: `${days} days asked for; at most ${MAX_DAYS} in one workbook` };
  return { span: { from: f, to: t } };
}

const mark = (span: Span, s: SpanStats): ExportMark => ({
  ...span, orders: s.orders, lines: s.lines, lastOrderId: s.lastOrderId, lineTotalCents: s.lineTotalCents,
});

function sheets(db: Db, span: Span, s: SpanStats, asOf: Date): Sheet[] {
  async function* rows(): AsyncGenerator<Cell[]> {
    for await (const l of saleLines(db, span, asOf)) {
      const [date, time] = l.placedLocal.split(" ") as [string, string];
      const [hour, minute] = time.split(":").map(Number) as [number, number];
      yield [
        { day: l.day }, l.ticket, l.source === "visitor" ? "Visitor" : "Simulated", { local: { date, hour, minute } },
        l.item, l.qty, { cents: l.priceCents }, { cents: l.qty * l.priceCents },
      ];
    }
  }
  return [
    {
      name: "Sales",
      columns: [
        { header: "Day", width: 12 }, { header: "Ticket", width: 9 }, { header: "Placed by", width: 11 }, { header: "Placed (Austin)", width: 17 },
        { header: "Item", width: 26 }, { header: "Qty", width: 6 }, { header: "Unit price", width: 11 }, { header: "Line total", width: 11 },
      ],
      rows: rows(),
    },
    {
      // counted by separate queries from the rows above, so the two can be checked against each other
      name: "Totals",
      columns: [{ header: "Figure", width: 40 }, { header: "Value", width: 18 }],
      rows: [
        ["Sally Mander's is a simulated coffee shop", "South Austin"],
        ["From", { day: span.from }],
        ["To", { day: span.to }],
        ["As of (UTC)", asOf.toISOString()],
        ["Orders", s.orders],
        ["Order lines (rows on the Sales sheet)", s.lines],
        ["Items sold", s.itemsSold],
        ["Sales before tax", { cents: s.subtotalCents }],
        ["Tax", { cents: s.taxCents }],
        ["Checks whose lines don't add up", s.mismatched],
      ],
    },
  ];
}

/**
 * One export request, decided before anything is streamed: a bad span is a 400, a span whose
 * checks don't add up is a 409 (nothing half-right goes out), a repeat with nothing new is
 * "unchanged", and anything else is a workbook to stream.
 */
export async function exportSales(
  db: Db,
  q: { from: string | null; to: string | null; ifNoneMatch: string | null },
  now: Date,
  nothingNew: (before: ExportMark, now: ExportMark) => boolean = defaultNothingNew,
): Promise<ExportResult> {
  const asked = parseSpan(q.from, q.to, now);
  if ("title" in asked) return { kind: "problem", status: 400, ...asked };
  const { span } = asked;
  const stats = await spanStats(db, span, now);
  if (stats.mismatched > 0) {
    return { kind: "problem", status: 409, title: "These checks don't add up", detail: `${stats.mismatched} order(s) in the span have lines that don't sum to the subtotal; nothing was exported` };
  }
  const current = mark(span, stats);
  const tag = tagFor(current);
  const before = marksIn(q.ifNoneMatch).find((m) => m.from === span.from && m.to === span.to);
  if (before && nothingNew(before, current)) return { kind: "unchanged", tag, stats };
  return {
    kind: "workbook",
    tag,
    stats,
    filename: `sally-manders-sales-${span.from}-to-${span.to}.xlsx`,
    body: () => workbook(sheets(db, span, stats, now), now),
  };
}
