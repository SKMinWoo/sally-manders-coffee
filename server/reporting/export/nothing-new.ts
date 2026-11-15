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
  // TODO(Alex): decide what "nothing changed" means. Return true only when re-sending would give
  // the visitor the same rows. Every field of `now` is counted fresh for this request.
  void before;
  void now;
  return false;
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
