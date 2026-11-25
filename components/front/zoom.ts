// Where the model's camera glides when something on it is being looked at. Everything is in the
// hero's own pixels (cutaway.json), so the glide, the pins and the close-ups agree at any width.

/** A rectangle of the hero, [x0, y0, x1, y1] in its pixels, always the hero's own shape. */
export type Rect = [number, number, number, number];

/** How far a plate may push in: no further than a picked fixture does (art/cutaway/cutaway.py's CLOSE_Z). */
const MAX_Z = 2.2;
/** Below this the push-in is too small to read as a move, so the plate leaves the model whole. */
const MIN_Z = 1.08;
/** Room left round a plate's rooms, as a share of their own size. */
const PAD = 0.08;

/** The rectangle that frames a plate's rooms: their outline plus a margin, at the hero's shape. */
export function plateRect(zones: readonly string[], all: Record<string, [number, number][]>, [W, H]: [number, number]): Rect | null {
  const pts = zones.flatMap((z) => all[z] ?? []);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const w = Math.max((x1 - x0) * (1 + 2 * PAD), ((y1 - y0) * (1 + 2 * PAD) * W) / H, W / MAX_Z);
  if (W / w < MIN_Z) return null;
  const h = (w * H) / W;
  const cx = Math.min(Math.max((x0 + x1) / 2, w / 2), W - w / 2);
  const cy = Math.min(Math.max((y0 + y1) / 2, h / 2), H - h / 2);
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}

/** The film's transform that makes `r` fill the frame (with transform-origin at its top left). */
export function lensTransform(r: Rect | null, [W, H]: [number, number]): string | undefined {
  if (!r) return undefined;
  const z = W / (r[2] - r[0]);
  return `scale(${z.toFixed(4)}) translate(${((-100 * r[0]) / W).toFixed(3)}%, ${((-100 * r[1]) / H).toFixed(3)}%)`;
}

/** Where a point of the hero sits in the frame while `r` fills it, as 0..1 (outside means off it). */
export function place([x, y]: [number, number], r: Rect | null, [W, H]: [number, number]): [number, number] {
  if (!r) return [x / W, y / H];
  return [(x - r[0]) / (r[2] - r[0]), (y - r[1]) / (r[3] - r[1])];
}
