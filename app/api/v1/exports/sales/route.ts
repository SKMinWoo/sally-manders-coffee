import { respond } from "@/server/platform/http";
import { problem } from "@/server/api/v1";
import { shopDb } from "@/server/platform/db/client";
import { exportSales, XLSX, type ExportResult } from "@/server/reporting";

// never cached: each request is checked against what the visitor already has
const COMMON = { "Cache-Control": "private, no-cache", "Access-Control-Expose-Headers": "ETag, X-Export-Rows" };

async function decide(req: Request): Promise<ExportResult | Response> {
  try {
    const url = new URL(req.url);
    return await exportSales(await shopDb(), {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      ifNoneMatch: req.headers.get("if-none-match"),
    }, new Date());
  } catch (err) {
    console.error("export error", err);
    return respond(problem(500, "Something went wrong at the counter"));
  }
}

function headers(r: Extract<ExportResult, { tag: string }>): Record<string, string> {
  return { ...COMMON, ETag: r.tag, "X-Export-Rows": String(r.stats.lines) };
}

/** A bounded stream of the workbook: each pull asks the generator for the next chunk. */
function stream(gen: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async pull(c) {
      const { value, done } = await gen.next();
      if (done) c.close();
      else c.enqueue(value);
    },
    async cancel() {
      await gen.return(undefined);
    },
  });
}

async function answer(req: Request, withBody: boolean): Promise<Response> {
  const r = await decide(req);
  if (r instanceof Response) return r;
  if (r.kind === "problem") return respond(problem(r.status, r.title, r.detail));
  if (r.kind === "unchanged") return new Response(null, { status: 304, headers: headers(r) });
  return new Response(withBody ? stream(r.body()) : null, {
    status: 200,
    headers: { ...headers(r), "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${r.filename}"` },
  });
}

export const GET = (req: Request) => answer(req, true);
// the button asks first, so a repeat with nothing new never starts a download
export const HEAD = (req: Request) => answer(req, false);
