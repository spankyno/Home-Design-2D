export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

function angleRad(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return Math.atan2(by - ay, bx - ax);
}

export function angleDeg(
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return (angleRad(ax, ay, bx, by) * 180) / Math.PI;
}

export function snapToAngle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  step = 45,
): { x: number; y: number } {
  const len = dist(ax, ay, bx, by);
  if (len < 1e-6) return { x: bx, y: by };
  const a = angleDeg(ax, ay, bx, by);
  const snapped = Math.round(a / step) * step;
  const rad = (snapped * Math.PI) / 180;
  return { x: ax + len * Math.cos(rad), y: ay + len * Math.sin(rad) };
}

export function snapToGrid(
  x: number,
  y: number,
  grid: number,
): { x: number; y: number } {
  return {
    x: Math.round(x / grid) * grid,
    y: Math.round(y / grid) * grid,
  };
}

interface ClosestPoint {
  dist: number;
  t: number;
  x: number;
  y: number;
}

export function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): ClosestPoint {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return { dist: Math.hypot(px - x, py - y), t, x, y };
}

export function polygonArea(points: { x: number; y: number }[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export function polygonCentroid(points: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-9) {
    const n = points.length || 1;
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: cx / (6 * area), y: cy / (6 * area) };
}

export function pointInPolygon(
  px: number,
  py: number,
  points: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
