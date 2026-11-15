// Just enough of a PNG reader for the screenshots Playwright takes: 8 bits a channel, RGB or RGBA,
// not interlaced. Node's zlib does the inflating; the rest is undoing each row's filter.

import { inflateSync } from "node:zlib";

export interface Picture {
  width: number;
  height: number;
  /** a lightness for each pixel, 0 (black) to 255, row by row */
  light: Float32Array;
}

const SIGNATURE = "89504e470d0a1a0a";

export function readPng(png: Buffer): Picture {
  if (png.subarray(0, 8).toString("hex") !== SIGNATURE) throw new Error("not a PNG");
  let width = 0, height = 0, channels = 0;
  const data: Buffer[] = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = body.subarray(8, 13);
      channels = colour === 6 ? 4 : colour === 2 ? 3 : 0;
      if (depth !== 8 || !channels || interlace) throw new Error(`unsupported PNG: depth ${depth}, colour ${colour}`);
    } else if (type === "IDAT") data.push(body);
    else if (type === "IEND") break;
    at += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? out[y * stride + x - channels]! : 0;
      const up = y ? out[(y - 1) * stride + x]! : 0;
      const corner = y && x >= channels ? out[(y - 1) * stride + x - channels]! : 0;
      let v = row[x]!;
      if (filter === 1) v += left;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner, pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - corner);
        v += pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      out[y * stride + x] = v & 255;
    }
  }

  const light = new Float32Array(width * height);
  for (let i = 0; i < light.length; i++) {
    const [r, g, b] = [out[i * channels]!, out[i * channels + 1]!, out[i * channels + 2]!];
    light[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return { width, height, light };
}

/** One row of a picture, `fraction` of the way down. */
export const rowAt = (p: Picture, fraction: number) => {
  const y = Math.min(p.height - 1, Math.floor(p.height * fraction));
  return p.light.subarray(y * p.width, (y + 1) * p.width);
};
