// A zip written as it goes, for the workbook export. Each entry's CRC and sizes are only known
// once its data has gone by, so they follow the data in a "data descriptor" (general-purpose
// flag bit 3) instead of sitting in the header in front of it. That is what lets a sheet of any
// length stream straight out of the database without ever being held whole in memory.
// Spec: PKWARE APPNOTE.TXT 6.3, sections 4.3.7 (local header), 4.3.9 (descriptor), 4.3.12 (central
// directory) and 4.3.16 (end record). No ZIP64: the export is capped far below 4 GB.

import { Readable } from "node:stream";
import { crc32, createDeflateRaw } from "node:zlib";

export type ZipEntry = { name: string; data: AsyncIterable<Uint8Array> | Iterable<Uint8Array> };

const DESCRIPTOR_FLAG = 0x0008;
const UTF8_FLAG = 0x0800;
const DEFLATE = 8;

/** MS-DOS time and date, the only timestamp a plain zip header has (2-second resolution, local). */
function dosStamp(at: Date): { time: number; date: number } {
  return {
    time: (at.getHours() << 11) | (at.getMinutes() << 5) | (at.getSeconds() >> 1),
    date: ((at.getFullYear() - 1980) << 9) | ((at.getMonth() + 1) << 5) | at.getDate(),
  };
}

function header(fields: [bytes: 2 | 4, value: number][], name: Buffer): Buffer {
  const size = fields.reduce((n, [b]) => n + b, 0);
  const out = Buffer.alloc(size + name.length);
  let at = 0;
  for (const [bytes, value] of fields) at = bytes === 2 ? out.writeUInt16LE(value, at) : out.writeUInt32LE(value >>> 0, at);
  name.copy(out, at);
  return out;
}

/** The zip as a stream of chunks. Entries are written in order, each compressed as it arrives. */
export async function* zip(entries: Iterable<ZipEntry>, at: Date = new Date()): AsyncGenerator<Uint8Array> {
  const { time, date } = dosStamp(at);
  const flags = DESCRIPTOR_FLAG | UTF8_FLAG;
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const local = header(
      [[4, 0x04034b50], [2, 20], [2, flags], [2, DEFLATE], [2, time], [2, date], [4, 0], [4, 0], [4, 0], [2, name.length], [2, 0]],
      name,
    );
    yield local;

    let crc = 0, size = 0, packed = 0;
    async function* counted() {
      for await (const chunk of entry.data) {
        crc = crc32(chunk, crc);
        size += chunk.length;
        yield chunk;
      }
    }
    for await (const out of Readable.from(counted()).pipe(createDeflateRaw({ level: 6 }))) {
      packed += (out as Buffer).length;
      yield out as Buffer;
    }
    yield header([[4, 0x08074b50], [4, crc], [4, packed], [4, size]], Buffer.alloc(0));

    central.push(
      header(
        [
          [4, 0x02014b50], [2, 20], [2, 20], [2, flags], [2, DEFLATE], [2, time], [2, date],
          [4, crc], [4, packed], [4, size], [2, name.length], [2, 0], [2, 0], [2, 0], [2, 0], [4, 0], [4, offset],
        ],
        name,
      ),
    );
    offset += local.length + packed + 16;
  }

  const directory = Buffer.concat(central);
  yield directory;
  yield header(
    [[4, 0x06054b50], [2, 0], [2, 0], [2, central.length], [2, central.length], [4, directory.length], [4, offset], [2, 0]],
    Buffer.alloc(0),
  );
}
