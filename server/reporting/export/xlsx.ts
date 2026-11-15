// A minimal Office Open XML workbook (ECMA-376), written as a stream. Strings are inline rather
// than in a shared-strings table, because a shared table has to be complete before the first
// sheet that uses it, which would mean holding every string in memory. The trade is a larger
// file before compression; deflate takes most of it back, since the repeats are close together.

import { zip } from "./zip";

/** A cell: text, a number, an amount in cents, or a date and time on the shop's wall clock. */
export type Cell = string | number | { cents: number } | { local: LocalTime } | { day: string };
export type LocalTime = { date: string; hour: number; minute: number };
export type Sheet = { name: string; columns: { header: string; width: number }[]; rows: AsyncIterable<Cell[]> | Iterable<Cell[]> };

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// style ids into styles.xml's cellXfs, in order
const S = { header: 1, money: 2, local: 3, day: 4 } as const;

const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s);

/** Text as XML: escaped, and without the control characters XML 1.0 forbids outright. */
export function xmlText(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Excel's date serial: days since 30 Dec 1899, with the time as the fraction. Written in full
 * (shortest round-trip form): six decimals of a day would put a minute 10 ms off. */
const serial = (date: string, hour = 0, minute = 0) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d, hour, minute) / 86_400_000 + 25_569;
};

function cell(c: Cell): string {
  if (typeof c === "string") return `<c t="inlineStr"><is><t xml:space="preserve">${xmlText(c)}</t></is></c>`;
  if (typeof c === "number") {
    if (!Number.isFinite(c)) throw new Error(`Not a number a sheet can hold: ${c}`);
    return `<c><v>${c}</v></c>`;
  }
  if ("cents" in c) return `<c s="${S.money}"><v>${(c.cents / 100).toFixed(2)}</v></c>`;
  if ("day" in c) return `<c s="${S.day}"><v>${serial(c.day)}</v></c>`;
  return `<c s="${S.local}"><v>${String(serial(c.local.date, c.local.hour, c.local.minute))}</v></c>`;
}

const ROWS_PER_CHUNK = 500;

async function* sheetXml(sheet: Sheet): AsyncGenerator<Uint8Array> {
  const cols = sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join("");
  const head = sheet.columns.map((c) => `<c t="inlineStr" s="${S.header}"><is><t>${xmlText(c.header)}</t></is></c>`).join("");
  yield bytes(
    `${XML}<worksheet xmlns="${NS}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<cols>${cols}</cols><sheetData><row>${head}</row>`,
  );
  let buf: string[] = [];
  for await (const row of sheet.rows) {
    buf.push(`<row>${row.map(cell).join("")}</row>`);
    if (buf.length === ROWS_PER_CHUNK) {
      yield bytes(buf.join(""));
      buf = [];
    }
  }
  yield bytes(`${buf.join("")}</sheetData></worksheet>`);
}

const STYLES =
  `${XML}<styleSheet xmlns="${NS}">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>` +
  `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>` +
  `<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>` +
  // the named "Normal" style: without it Excel may offer to repair the file, and openpyxl warns
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** The workbook as a stream of zip chunks: sheets in order, each written as its rows arrive. */
export function workbook(sheets: Sheet[], at: Date = new Date()): AsyncGenerator<Uint8Array> {
  if (!sheets.length || sheets.length > 9) throw new Error("A workbook here has one to nine sheets");
  for (const s of sheets) if (!/^[^\\/?*[\]:]{1,31}$/.test(s.name)) throw new Error(`Not a sheet name Excel allows: "${s.name}"`);
  const n = sheets.map((_, i) => i + 1);
  const fixed = (name: string, xml: string) => ({ name, data: [bytes(xml)] });
  return zip(
    [
      fixed(
        "[Content_Types].xml",
        `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>` +
          `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
          `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
          n.map((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
          `</Types>`,
      ),
      fixed("_rels/.rels", `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      fixed(
        "xl/workbook.xml",
        `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><sheets>` +
          sheets.map((s, i) => `<sheet name="${xmlText(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
          `</sheets></workbook>`,
      ),
      fixed(
        "xl/_rels/workbook.xml.rels",
        `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          n.map((i) => `<Relationship Id="rId${i}" Type="${REL}/worksheet" Target="worksheets/sheet${i}.xml"/>`).join("") +
          `<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
      ),
      fixed("xl/styles.xml", STYLES),
      ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })),
    ],
    at,
  );
}
