import type { Doc, RoomInfo } from "../types";
import { polygonArea, polygonCentroid } from "./geometry";

const MIN_ROOM_AREA = 100; // cm^2

interface Edge {
  from: string;
  to: string;
}

export function detectRooms(doc: Doc): RoomInfo[] {
  const nodes = doc.nodes;
  const walls = Object.values(doc.walls);

  // Build adjacency. Ignore degenerate / duplicate edges.
  const adj = new Map<string, string[]>();
  const edgeSet = new Set<string>();
  const addAdj = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    const list = adj.get(a)!;
    if (!list.includes(b)) list.push(b);
  };
  for (const w of walls) {
    if (w.a === w.b) continue;
    if (!nodes[w.a] || !nodes[w.b]) continue;
    addAdj(w.a, w.b);
    addAdj(w.b, w.a);
    edgeSet.add(`${w.a}->${w.b}`);
    edgeSet.add(`${w.b}->${w.a}`);
  }

  // Sort neighbors around each node by angle (ascending).
  const sortedAdj = new Map<string, string[]>();
  for (const [id, neighbors] of adj.entries()) {
    const n = nodes[id];
    const arr = [...neighbors].sort((p, q) => {
      const ap = Math.atan2(nodes[p].y - n.y, nodes[p].x - n.x);
      const aq = Math.atan2(nodes[q].y - n.y, nodes[q].x - n.x);
      return ap - aq;
    });
    sortedAdj.set(id, arr);
  }

  const nextHalfEdge = (from: string, to: string): Edge | null => {
    const neighbors = sortedAdj.get(to);
    if (!neighbors || neighbors.length === 0) return null;
    const idx = neighbors.indexOf(from);
    if (idx === -1) return null;
    // clockwise neighbor of the reverse edge
    const nextNode = neighbors[(idx - 1 + neighbors.length) % neighbors.length];
    return { from: to, to: nextNode };
  };

  const visited = new Set<string>();
  const rooms: RoomInfo[] = [];

  for (const startKey of edgeSet) {
    if (visited.has(startKey)) continue;
    const [sFrom, sTo] = startKey.split("->");
    const cycle: string[] = [];
    let cur: Edge | null = { from: sFrom, to: sTo };
    let guard = 0;
    let ok = true;
    while (cur && guard < 10000) {
      guard++;
      const key = `${cur.from}->${cur.to}`;
      if (visited.has(key)) {
        ok = false;
        break;
      }
      visited.add(key);
      cycle.push(cur.from);
      const nxt = nextHalfEdge(cur.from, cur.to);
      if (!nxt) {
        ok = false;
        break;
      }
      if (nxt.from === sFrom && nxt.to === sTo) {
        cur = null;
        break;
      }
      cur = nxt;
    }
    if (!ok || cycle.length < 3) continue;

    const points = cycle.map((id) => ({ x: nodes[id].x, y: nodes[id].y }));
    const signed = polygonArea(points);
    // Interior (bounded) faces are traced with positive signed area
    // in screen coordinates; the outer face is negative.
    if (signed <= 0) continue;
    const area = signed;
    if (area < MIN_ROOM_AREA) continue;

    const sortedIds = [...cycle].sort();
    const id = sortedIds.join("|");
    if (rooms.some((r) => r.id === id)) continue;

    rooms.push({
      id,
      nodeIds: cycle,
      points,
      area,
      centroid: polygonCentroid(points),
    });
  }

  return rooms;
}
