import type { Furniture, TextItem } from "../types";

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export interface Box {
  minx: number;
  maxx: number;
  miny: number;
  maxy: number;
}

/** Axis-aligned bounding box of a rotated w×h rectangle centred at (x, y). */
function rotatedBox(x: number, y: number, w: number, h: number, deg: number): Box {
  const rad = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(rad));
  const s = Math.abs(Math.sin(rad));
  const ex = (c * w + s * h) / 2;
  const ey = (s * w + c * h) / 2;
  return { minx: x - ex, maxx: x + ex, miny: y - ey, maxy: y + ey };
}

export function furnitureBox(f: Pick<Furniture, "x" | "y" | "w" | "h" | "rotation">): Box {
  return rotatedBox(f.x, f.y, f.w, f.h, f.rotation);
}

export function textBox(
  t: Pick<TextItem, "x" | "y" | "text" | "fontSize" | "rotation">,
): Box {
  const w = Math.max(t.fontSize, t.text.length * t.fontSize * 0.62);
  return rotatedBox(t.x, t.y, w, t.fontSize * 1.2, t.rotation);
}

// ------------------------------------------------------------------ align
export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

export interface Placed {
  type: "furniture" | "text";
  id: string;
  box: Box;
}

export interface Move {
  type: "furniture" | "text";
  id: string;
  dx: number;
  dy: number;
}

export function alignMoves(items: Placed[], mode: AlignMode): Move[] {
  if (items.length < 2) return [];
  const g: Box = {
    minx: Math.min(...items.map((i) => i.box.minx)),
    maxx: Math.max(...items.map((i) => i.box.maxx)),
    miny: Math.min(...items.map((i) => i.box.miny)),
    maxy: Math.max(...items.map((i) => i.box.maxy)),
  };
  return items
    .map((i) => {
      let dx = 0;
      let dy = 0;
      const cx = (i.box.minx + i.box.maxx) / 2;
      const cy = (i.box.miny + i.box.maxy) / 2;
      if (mode === "left") dx = g.minx - i.box.minx;
      else if (mode === "right") dx = g.maxx - i.box.maxx;
      else if (mode === "hcenter") dx = (g.minx + g.maxx) / 2 - cx;
      else if (mode === "top") dy = g.miny - i.box.miny;
      else if (mode === "bottom") dy = g.maxy - i.box.maxy;
      else dy = (g.miny + g.maxy) / 2 - cy;
      return { type: i.type, id: i.id, dx, dy };
    })
    .filter((m) => Math.abs(m.dx) > 1e-6 || Math.abs(m.dy) > 1e-6);
}

/** Equalise the gaps between items; the two outermost stay where they are. */
export function distributeMoves(items: Placed[], axis: "x" | "y"): Move[] {
  if (items.length < 3) return [];
  const lo = axis === "x" ? "minx" : "miny";
  const hi = axis === "x" ? "maxx" : "maxy";
  const sorted = [...items].sort(
    (a, b) => a.box[lo] + a.box[hi] - (b.box[lo] + b.box[hi]),
  );
  const span =
    Math.max(...sorted.map((i) => i.box[hi])) - sorted[0].box[lo];
  const total = sorted.reduce((s, i) => s + (i.box[hi] - i.box[lo]), 0);
  const gap = (span - total) / (sorted.length - 1);
  let cursor = sorted[0].box[lo];
  const moves: Move[] = [];
  for (const i of sorted) {
    const d = cursor - i.box[lo];
    cursor += i.box[hi] - i.box[lo] + gap;
    if (Math.abs(d) > 1e-6) {
      moves.push({
        type: i.type,
        id: i.id,
        dx: axis === "x" ? d : 0,
        dy: axis === "y" ? d : 0,
      });
    }
  }
  return moves;
}

// ----------------------------------------------------------- smart guides
export interface Guide {
  axis: "x" | "y"; // "x" = vertical line at x = pos
  pos: number;
  a: number; // extent along the line
  b: number;
}

/**
 * Snap `box` so its edges/centre line up with the edges/centres of `others`
 * or with `points` (wall corners) when within `tol` (world units).
 * Returns the correction to apply plus the guide lines to draw.
 */
export function snapBox(
  box: Box,
  others: Box[],
  points: { x: number; y: number }[],
  tol: number,
): { dx: number; dy: number; guides: Guide[] } {
  const stops = (lo: number, hi: number) => [lo, (lo + hi) / 2, hi];

  const best = (axis: "x" | "y") => {
    const mine =
      axis === "x" ? stops(box.minx, box.maxx) : stops(box.miny, box.maxy);
    let delta = 0;
    let bestAbs = Infinity;
    const consider = (target: number) => {
      for (const s of mine) {
        const d = target - s;
        if (Math.abs(d) <= tol && Math.abs(d) < bestAbs) {
          bestAbs = Math.abs(d);
          delta = d;
        }
      }
    };
    for (const o of others) {
      for (const t of axis === "x"
        ? stops(o.minx, o.maxx)
        : stops(o.miny, o.maxy)) {
        consider(t);
      }
    }
    for (const p of points) consider(axis === "x" ? p.x : p.y);
    return bestAbs === Infinity ? 0 : delta;
  };

  const dx = best("x");
  const dy = best("y");
  const m: Box = {
    minx: box.minx + dx,
    maxx: box.maxx + dx,
    miny: box.miny + dy,
    maxy: box.maxy + dy,
  };

  const lines = new Map<string, Guide>();
  const add = (axis: "x" | "y", pos: number, a: number, b: number) => {
    const key = `${axis}:${Math.round(pos * 10)}`;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const cur = lines.get(key);
    if (cur) {
      cur.a = Math.min(cur.a, lo);
      cur.b = Math.max(cur.b, hi);
    } else lines.set(key, { axis, pos, a: lo, b: hi });
  };
  const EPS = 0.01;
  const mx = stops(m.minx, m.maxx);
  const my = stops(m.miny, m.maxy);

  for (const o of others) {
    for (const t of stops(o.minx, o.maxx)) {
      if (mx.some((s) => Math.abs(s - t) < EPS)) {
        add("x", t, Math.min(m.miny, o.miny), Math.max(m.maxy, o.maxy));
      }
    }
    for (const t of stops(o.miny, o.maxy)) {
      if (my.some((s) => Math.abs(s - t) < EPS)) {
        add("y", t, Math.min(m.minx, o.minx), Math.max(m.maxx, o.maxx));
      }
    }
  }
  for (const p of points) {
    if (mx.some((s) => Math.abs(s - p.x) < EPS)) {
      add("x", p.x, Math.min(m.miny, p.y), Math.max(m.maxy, p.y));
    }
    if (my.some((s) => Math.abs(s - p.y) < EPS)) {
      add("y", p.y, Math.min(m.minx, p.x), Math.max(m.maxx, p.x));
    }
  }
  return { dx, dy, guides: [...lines.values()] };
}
