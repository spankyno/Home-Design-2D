import type { Doc, Opening } from "../types";
import { dist } from "./geometry";

export interface WallGeom {
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  len: number;
  ux: number;
  uy: number;
  nx: number;
  ny: number;
  thickness: number;
}

export function wallGeom(doc: Doc, wallId: string): WallGeom | null {
  const w = doc.walls[wallId];
  if (!w) return null;
  const a = doc.nodes[w.a];
  const b = doc.nodes[w.b];
  if (!a || !b) return null;
  const len = dist(a.x, a.y, b.x, b.y);
  const ux = len === 0 ? 1 : (b.x - a.x) / len;
  const uy = len === 0 ? 0 : (b.y - a.y) / len;
  return {
    id: w.id,
    ax: a.x,
    ay: a.y,
    bx: b.x,
    by: b.y,
    len,
    ux,
    uy,
    nx: -uy,
    ny: ux,
    thickness: w.thickness,
  };
}

export function openingsOfWall(doc: Doc, wallId: string): Opening[] {
  const all = [...Object.values(doc.doors), ...Object.values(doc.windows)];
  return all
    .filter((o) => o.wallId === wallId)
    .sort((p, q) => p.offset - q.offset);
}

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Returns the solid wall segments (the wall line minus opening gaps).
export function wallSegments(doc: Doc, wallId: string): Segment[] {
  const g = wallGeom(doc, wallId);
  if (!g) return [];
  const ops = openingsOfWall(doc, wallId);
  const gaps: [number, number][] = ops.map((o) => [
    Math.max(0, o.offset - o.width / 2),
    Math.min(g.len, o.offset + o.width / 2),
  ]);
  const segs: Segment[] = [];
  let cursor = 0;
  for (const [start, end] of gaps) {
    if (start > cursor) {
      segs.push(pointSeg(g, cursor, start));
    }
    cursor = Math.max(cursor, end);
  }
  if (cursor < g.len) {
    segs.push(pointSeg(g, cursor, g.len));
  }
  return segs;
}

function pointSeg(g: WallGeom, t1: number, t2: number): Segment {
  return {
    x1: g.ax + g.ux * t1,
    y1: g.ay + g.uy * t1,
    x2: g.ax + g.ux * t2,
    y2: g.ay + g.uy * t2,
  };
}

export interface DoorSym {
  // jamb points
  j1x: number;
  j1y: number;
  j2x: number;
  j2y: number;
  // hinge point (door leaf pivot)
  hingeX: number;
  hingeY: number;
  // door leaf line end (open position)
  lx: number;
  ly: number;
  // arc start + end + radius
  arcStartX: number;
  arcStartY: number;
  arcEndX: number;
  arcEndY: number;
  r: number;
  sweep: 0 | 1;
  capThickness: number;
}

export function doorSymbol(doc: Doc, op: Opening): DoorSym | null {
  const g = wallGeom(doc, op.wallId);
  if (!g) return null;
  const t1 = op.offset - op.width / 2;
  const t2 = op.offset + op.width / 2;
  const j1x = g.ax + g.ux * t1;
  const j1y = g.ay + g.uy * t1;
  const j2x = g.ax + g.ux * t2;
  const j2y = g.ay + g.uy * t2;
  // hinge at near jamb (j1) by default; flipX moves it to the far jamb (j2)
  const flipX = op.flipX ?? false;
  const flipY = op.flipY ?? false;
  const hingeX = flipX ? j2x : j1x;
  const hingeY = flipX ? j2y : j1y;
  // along-wall direction from hinge toward the other jamb
  const along = flipX ? -1 : 1;
  // swing side across the wall
  const s = flipY ? -1 : 1;
  // leaf end = hinge + normal * width (swing side)
  const lx = hingeX + g.nx * s * op.width;
  const ly = hingeY + g.ny * s * op.width;
  // arc from along-wall point (the other jamb) to leaf end
  const arcStartX = hingeX + g.ux * along * op.width;
  const arcStartY = hingeY + g.uy * along * op.width;
  // pick the sweep flag so the arc's center stays at the hinge
  const cross = g.ux * along * (g.ny * s) - g.uy * along * (g.nx * s);
  const sweep: 0 | 1 = cross > 0 ? 1 : 0;
  return {
    j1x,
    j1y,
    j2x,
    j2y,
    hingeX,
    hingeY,
    lx,
    ly,
    arcStartX,
    arcStartY,
    arcEndX: lx,
    arcEndY: ly,
    r: op.width,
    sweep,
    capThickness: g.thickness,
  };
}

export interface WindowSym {
  j1x: number;
  j1y: number;
  j2x: number;
  j2y: number;
  nx: number;
  ny: number;
  thickness: number;
}

export function windowSymbol(doc: Doc, op: Opening): WindowSym | null {
  const g = wallGeom(doc, op.wallId);
  if (!g) return null;
  const t1 = op.offset - op.width / 2;
  const t2 = op.offset + op.width / 2;
  return {
    j1x: g.ax + g.ux * t1,
    j1y: g.ay + g.uy * t1,
    j2x: g.ax + g.ux * t2,
    j2y: g.ay + g.uy * t2,
    nx: g.nx,
    ny: g.ny,
    thickness: g.thickness,
  };
}

export interface DimLabel {
  x: number;
  y: number;
  len: number;
  angle: number;
}

export function dimensionLabels(doc: Doc): DimLabel[] {
  const out: DimLabel[] = [];
  for (const id of Object.keys(doc.walls)) {
    const g = wallGeom(doc, id);
    if (!g || g.len < 1) continue;
    const off = g.thickness / 2 + 14;
    out.push({
      x: (g.ax + g.bx) / 2 + g.nx * off,
      y: (g.ay + g.by) / 2 + g.ny * off,
      len: g.len,
      angle: (Math.atan2(g.by - g.ay, g.bx - g.ax) * 180) / Math.PI,
    });
  }
  return out;
}

export interface JointGeom {
  x: number;
  y: number;
  size: number;
}

export function joints(doc: Doc): JointGeom[] {
  const degree = new Map<string, number>();
  const maxTh = new Map<string, number>();
  for (const w of Object.values(doc.walls)) {
    degree.set(w.a, (degree.get(w.a) ?? 0) + 1);
    degree.set(w.b, (degree.get(w.b) ?? 0) + 1);
    maxTh.set(w.a, Math.max(maxTh.get(w.a) ?? 0, w.thickness));
    maxTh.set(w.b, Math.max(maxTh.get(w.b) ?? 0, w.thickness));
  }
  const out: JointGeom[] = [];
  for (const [id, deg] of degree.entries()) {
    if (deg < 2) continue;
    const n = doc.nodes[id];
    if (!n) continue;
    out.push({ x: n.x, y: n.y, size: maxTh.get(id) ?? 10 });
  }
  return out;
}

export function docBBox(doc: Doc): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const nodes = Object.values(doc.nodes);
  const furniture = Object.values(doc.furniture);
  const texts = Object.values(doc.texts);
  if (nodes.length === 0 && furniture.length === 0 && texts.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxTh = 10;
  for (const w of Object.values(doc.walls)) maxTh = Math.max(maxTh, w.thickness);
  const pad = maxTh / 2;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - pad);
    minY = Math.min(minY, n.y - pad);
    maxX = Math.max(maxX, n.x + pad);
    maxY = Math.max(maxY, n.y + pad);
  }
  // include furniture (rotated rectangle corners) so nothing is clipped
  for (const f of furniture) {
    const rad = (f.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = f.w / 2;
    const hh = f.h / 2;
    for (const [dx, dy] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]) {
      const x = f.x + dx * cos - dy * sin;
      const y = f.y + dx * sin + dy * cos;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  for (const item of texts) {
    const rad = (item.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const hw = Math.max(item.fontSize, item.text.length * item.fontSize * 0.62) / 2;
    const hh = item.fontSize;
    for (const [dx, dy] of [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ]) {
      const x = item.x + dx * cos - dy * sin;
      const y = item.y + dx * sin + dy * cos;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}
