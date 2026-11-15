// The export's own inspector: opens a finished workbook from its bytes, the way a spreadsheet
// would, and checks it. Every zip entry must inflate to its stated size and CRC, and the Sales
// sheet must agree with the Totals sheet, which separate queries counted. The tests and the CI
// benchmark both run it, so a workbook that opens but is wrong still fails.

import { crc32, inflateRawSync } from "node:zlib";

export type Value = string | number;

/** Each entry of a zip, inflated, after checking its CRC and size against the central directory. */
export function unzip(buf: Buffer): Map<string, Buffer> {
  let end = buf.length - 22;
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0) throw new Error("No end-of-directory record: not a zip");
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const out = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error(`Central directory entry ${i} is damaged`);
    const crc = buf.readUInt32LE(at + 16), packed = buf.readUInt32LE(at + 20), size = buf.readUInt32LE(at + 24);
    const n = buf.readUInt16LE(at + 28), extra = buf.readUInt16LE(at + 30), comment = buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + n).toString("utf8");
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error(`${name}: local header is missing`);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = inflateRawSync(buf.subarray(start, start + packed));
    if (data.length !== size) throw new Error(`${name}: ${data.length} bytes, directory says ${size}`);
    if (crc32(data) !== crc) throw new Error(`${name}: CRC doesn't match`);
    out.set(name, data);
    at += 46 + n + extra + comment;
  }
  return out;
}

const unescape = (s: string) =>
  s.replace(/&(lt|gt|quot|amp);/g, (_, e: string) => ({ lt: "<", gt: ">", quot: '"', amp: "&" })[e]!);

/** Each sheet's rows, by sheet name: inline strings as text, everything else as numbers. */
export function readWorkbook(buf: Buffer): Map<string, Value[][]> {
  const files = unzip(buf);
  const book = files.get("xl/workbook.xml")?.toString("utf8");
  if (!book) throw new Error("No xl/workbook.xml");
  const names = [...book.matchAll(/<sheet name="([^"]*)" sheetId="(\d+)"/g)].map((m) => [unescape(m[1]!), m[2]!] as const);
  const sheets = new Map<string, Value[][]>();
  for (const [name, id] of names) {
    const xml = files.get(`xl/worksheets/sheet${id}.xml`)?.toString("utf8");
    if (!xml) throw new Error(`Sheet "${name}" has no part`);
    const rows = [...xml.matchAll(/<row>(.*?)<\/row>/g)].map((r) =>
      [...r[1]!.matchAll(/<c[^>]*?(?: t="inlineStr")?>(?:<is><t[^>]*>(.*?)<\/t><\/is>|<v>(.*?)<\/v>)<\/c>/g)].map((c) =>
        c[1] !== undefined ? unescape(c[1]) : Number(c[2]),
      ),
    );
    sheets.set(name, rows);
  }
  return sheets;
}

export interface SalesCheck {
  rows: number;
  problems: string[];
}

const cents = (x: Value) => Math.round(Number(x) * 100);

/** Is this a sales export whose rows add up to its own totals? Lists everything that doesn't. */
export function checkSalesWorkbook(buf: Buffer): SalesCheck {
  const book = readWorkbook(buf);
  const sales = book.get("Sales"), totals = book.get("Totals");
  if (!sales || !totals) return { rows: 0, problems: ["Missing the Sales or Totals sheet"] };
  const [head, ...rows] = sales;
  const problems: string[] = [];
  if (head?.join("|") !== "Day|Ticket|Placed by|Placed (Austin)|Item|Qty|Unit price|Line total") problems.push(`Unexpected header: ${head?.join(", ")}`);
  const figure = (label: string) => totals.find((r) => r[0] === label)?.[1];

  let sum = 0;
  rows.forEach((r, i) => {
    if (r.length !== 8) return void problems.push(`Row ${i + 2} has ${r.length} cells`);
    const [, , , , , qty, unit, line] = r;
    if (!Number.isInteger(qty) || (qty as number) <= 0) problems.push(`Row ${i + 2}: qty ${qty}`);
    if ((qty as number) * cents(unit!) !== cents(line!)) problems.push(`Row ${i + 2}: ${qty} × ${unit} isn't ${line}`);
    sum += cents(line!);
  });
  if (figure("Order lines (rows on the Sales sheet)") !== rows.length) problems.push(`${rows.length} rows, Totals says ${figure("Order lines (rows on the Sales sheet)")}`);
  if (cents(figure("Sales before tax") ?? NaN) !== sum) problems.push(`Lines sum to ${sum / 100}, Totals says ${figure("Sales before tax")}`);
  if (figure("Checks whose lines don't add up") !== 0) problems.push("Totals reports checks that don't add up");
  return { rows: rows.length, problems: problems.slice(0, 20) };
}
