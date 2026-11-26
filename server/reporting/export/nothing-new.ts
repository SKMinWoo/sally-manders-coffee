// No-op detection for the sales export. A repeat request carries the tag of the workbook it got
// last time (If-None-Match); if nothing has changed since, it is answered 304 "Nothing changed
// since your last export" and no workbook is built at all.

import type { Span, SpanStats } from "../sales";

/** What a workbook's tag remembers about the span it was built from. */
export type ExportMark = Span & Pick<SpanStats, "orders" | "lines" | "lastOrderId" | "lineTotalCents">;

/**
 * Has nothing changed between the workbook the visitor already has (`before`) and what an export
 * would hold now? true answers 304 and builds nothing; false builds a fresh workbook.
 *
 * The span may still be open (it can end today, and the shop never closes), so new orders arrive
 * between requests. Simulated days are written ahead and only become visible as their time comes.
 */
export function isNothingNew(before: ExportMark, now: ExportMark): boolean {
  // Same rows means the same span, and the same orders in it. Orders are only ever added (a day
  // is written ahead and shows as its time comes; a half-written day is cleared and written again
  // under new ids), so a span whose order count, line count, newest order id and line total all
  // match the tag holds the rows the visitor already has. Anything else (a new order, a rewritten
  // day, another span) builds a fresh workbook.
  return (
    before.from === now.from &&
    before.to === now.to &&
    before.orders === now.orders &&
    before.lines === now.lines &&
    before.lastOrderId === now.lastOrderId &&
    before.lineTotalCents === now.lineTotalCents
  );
}

const PREFIX = "sales-v1.";

/** The ETag for a workbook: its mark, so a later request can say what it already has. */
export function tagFor(mark: ExportMark): string {
  return `"${PREFIX}${Buffer.from(JSON.stringify(mark)).toString("base64url")}"`;
}

/** The marks in an If-None-Match header, ignoring anything that isn't one of ours. */
export function marksIn(ifNoneMatch: string | null): ExportMark[] {
  if (!ifNoneMatch) return [];
  const marks: ExportMark[] = [];
  for (const raw of ifNoneMatch.split(",")) {
    const tag = raw.trim().replace(/^W\//, "").replace(/^"|"$/g, "");
    if (!tag.startsWith(PREFIX) || tag.length > 400) continue;
    try {
      const m = JSON.parse(Buffer.from(tag.slice(PREFIX.length), "base64url").toString("utf8")) as Partial<ExportMark>;
      const counts = [m.orders, m.lines, m.lastOrderId, m.lineTotalCents];
      if (typeof m.from === "string" && typeof m.to === "string" && counts.every((x) => Number.isSafeInteger(x))) marks.push(m as ExportMark);
    } catch {
      // a tag from somewhere else, or tampered with: treat it as no tag at all
    }
  }
  return marks;
}
