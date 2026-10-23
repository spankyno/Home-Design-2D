import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type {
  Furniture,
  ResolvedPoint,
  Selection,
  SelItem,
  TextItem,
} from "../types";
import { furnitureSymbol, type Prim } from "../lib/furniture";
import {
  dist,
  angleDeg,
  snapToAngle,
  snapToGrid,
  closestPointOnSegment,
} from "../lib/geometry";
import {
  wallGeom,
  wallSegments,
  doorSymbol,
  windowSymbol,
  dimensionLabels,
  joints,
} from "../lib/render";
import { formatLen, formatArea, gridMajorStep, gridMinorStep } from "../lib/units";
import {
  DEFAULT_FURNITURE_FILL,
  DEFAULT_STROKE,
  effectStyle,
  safeColor,
} from "../lib/appearance";

const DEFAULT_THICKNESS = 10;
const HIT_TOL = 8; // screen px

interface DragState {
  kind: "node" | "opening" | "furniture" | "furniture-rotate" | "text";
  id: string;
  openingKind?: "door" | "window";
  moved: boolean;
  sx: number;
  sy: number;
  // grab offset between pointer and furniture centre (world cm)
  ox?: number;
  oy?: number;
}

const ROT_HANDLE_DIST = 26; // screen px above furniture top edge

const DRAG_THRESHOLD = 3; // screen px before a click becomes a drag

interface MeasureState {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export default function CanvasView() {
  const store = useStore();
  const {
    doc,
    rooms,
    settings,
    view,
    tool,
    selection,
    multiSelection,
    setView,
    setSelection,
    setMultiSelection,
    setTool,
    setCanvasSize,
  } = store;

  const multiKeys = new Set(multiSelection.map((m) => `${m.type}:${m.id}`));
  const inMulti = (type: string, id: string) =>
    multiKeys.has(`${type}:${id}`);

  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [chainStart, setChainStart] = useState<ResolvedPoint | null>(null);
  const drag = useRef<DragState | null>(null);
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  );
  const [measure, setMeasure] = useState<MeasureState | null>(null);
  type Rect = { ax: number; ay: number; bx: number; by: number };
  const [marquee, setMarqueeState] = useState<Rect | null>(null);
  // Mirror the marquee in a ref so endInteraction always reads the latest box,
  // even if pointerup fires before React re-renders after the last move.
  const marqueeRef = useRef<Rect | null>(null);
  const setMarquee = (r: Rect | null) => {
    marqueeRef.current = r;
    setMarqueeState(r);
  };
  const marqueeActive = useRef(false);
  const spaceDown = useRef(false);
  // Mirror view in a ref so the native (non-passive) wheel listener always
  // reads the latest pan/zoom without re-binding on every view change.
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
      setCanvasSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setCanvasSize]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = true;
      if (e.key === "Escape") {
        setChainStart(null);
        setMeasure(null);
        setMarquee(null);
        marqueeActive.current = false;
        setSelection(null);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [setSelection]);

  // reset chain when leaving wall tool
  useEffect(() => {
    if (tool !== "wall") setChainStart(null);
    if (tool !== "measure") setMeasure(null);
  }, [tool]);

  // Figma-style trackpad navigation: two-finger scroll pans (x/y), pinch
  // (wheel + ctrlKey) zooms. Native non-passive listener so we can
  // preventDefault and stop the browser's own page zoom/scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey) {
        // pinch-to-zoom (or ctrl + wheel)
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const factor = Math.exp(-e.deltaY * 0.01);
        const newZ = Math.min(8, Math.max(0.05, v.z * factor));
        const wx = (sx - v.tx) / v.z;
        const wy = (sy - v.ty) / v.z;
        setView({ z: newZ, tx: sx - wx * newZ, ty: sy - wy * newZ });
      } else {
        // two-finger pan
        setView({ z: v.z, tx: v.tx - e.deltaX, ty: v.ty - e.deltaY });
      }
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, [setView]);

  const z = view.z;

  const toWorld = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { x: (sx - view.tx) / z, y: (sy - view.ty) / z };
  };

  // ---- hit testing (screen tolerance) ----
  const hitTest = (wx: number, wy: number): Selection => {
    const tol = HIT_TOL / z;
    // Text sits above plan geometry and furniture in the rendered stack.
    const textList = Object.values(doc.texts);
    for (let i = textList.length - 1; i >= 0; i--) {
      const item = textList[i];
      const p = toTextLocal(item, wx, wy);
      const width = Math.max(
        item.fontSize,
        item.text.length * item.fontSize * 0.62,
      );
      if (
        Math.abs(p.x) <= width / 2 + tol &&
        Math.abs(p.y) <= item.fontSize + tol
      ) {
        return { type: "text", id: item.id };
      }
    }
    // nodes first
    for (const n of Object.values(doc.nodes)) {
      if (dist(wx, wy, n.x, n.y) <= Math.max(tol, 6 / z)) {
        return { type: "node", id: n.id };
      }
    }
    // openings
    for (const op of Object.values(doc.doors)) {
      const g = wallGeom(doc, op.wallId);
      if (!g) continue;
      const cx = g.ax + g.ux * op.offset;
      const cy = g.ay + g.uy * op.offset;
      if (dist(wx, wy, cx, cy) <= Math.max(tol, op.width / 2)) {
        return { type: "door", id: op.id };
      }
    }
    for (const op of Object.values(doc.windows)) {
      const g = wallGeom(doc, op.wallId);
      if (!g) continue;
      const cx = g.ax + g.ux * op.offset;
      const cy = g.ay + g.uy * op.offset;
      if (dist(wx, wy, cx, cy) <= Math.max(tol, op.width / 2)) {
        return { type: "window", id: op.id };
      }
    }
    // furniture (topmost first)
    const furnList = Object.values(doc.furniture);
    for (let i = furnList.length - 1; i >= 0; i--) {
      const f = furnList[i];
      const l = toFurnitureLocal(f, wx, wy);
      const pad = 4 / z;
      if (Math.abs(l.x) <= f.w / 2 + pad && Math.abs(l.y) <= f.h / 2 + pad) {
        return { type: "furniture", id: f.id };
      }
    }
    // walls
    for (const id of Object.keys(doc.walls)) {
      const g = wallGeom(doc, id);
      if (!g) continue;
      const c = closestPointOnSegment(wx, wy, g.ax, g.ay, g.bx, g.by);
      if (c.dist <= Math.max(tol, g.thickness / 2)) {
        return { type: "wall", id };
      }
    }
    // rooms
    for (const r of rooms) {
      if (pointInPoly(wx, wy, r.points)) {
        return { type: "room", id: r.id };
      }
    }
    return null;
  };

  const findOpeningTarget = (
    wx: number,
    wy: number,
  ): { wallId: string; offset: number } | null => {
    let best: { wallId: string; offset: number; dist: number } | null = null;
    const tol = 16 / z;
    for (const id of Object.keys(doc.walls)) {
      const g = wallGeom(doc, id);
      if (!g) continue;
      const c = closestPointOnSegment(wx, wy, g.ax, g.ay, g.bx, g.by);
      if (c.dist <= tol && (!best || c.dist < best.dist)) {
        best = { wallId: id, offset: c.t * g.len, dist: c.dist };
      }
    }
    return best ? { wallId: best.wallId, offset: best.offset } : null;
  };

  // ---- point resolution for wall drawing: node > angle > grid ----
  const resolvePoint = (
    wx: number,
    wy: number,
    from: ResolvedPoint | null,
  ): ResolvedPoint => {
    const tol = 10 / z;
    // snap to existing node
    let nearest: { id: string; d: number; x: number; y: number } | null = null;
    for (const n of Object.values(doc.nodes)) {
      const d = dist(wx, wy, n.x, n.y);
      if (d <= tol && (!nearest || d < nearest.d)) {
        nearest = { id: n.id, d, x: n.x, y: n.y };
      }
    }
    if (nearest) {
      return { x: nearest.x, y: nearest.y, nodeId: nearest.id, snap: "node" };
    }
    let x = wx;
    let y = wy;
    let snap: ResolvedPoint["snap"] = "none";
    if (from && settings.angleSnap) {
      const s = snapToAngle(from.x, from.y, wx, wy, 45);
      x = s.x;
      y = s.y;
      snap = "angle";
    }
    if (settings.gridSnap) {
      const g = snapToGrid(x, y, gridMinorStep(settings.unit));
      x = g.x;
      y = g.y;
      snap = snap === "angle" ? "angle" : "grid";
    }
    return { x, y, snap };
  };

  // Collect every selectable item whose representative point falls inside the
  // given world-space rectangle. Walls require both endpoints inside (contain
  // mode), so a big marquee selects everything reliably.
  const itemsInRect = (ax: number, ay: number, bx: number, by: number) => {
    const minx = Math.min(ax, bx);
    const maxx = Math.max(ax, bx);
    const miny = Math.min(ay, by);
    const maxy = Math.max(ay, by);
    const inR = (px: number, py: number) =>
      px >= minx && px <= maxx && py >= miny && py <= maxy;
    const items: { type: SelItem["type"]; id: string }[] = [];
    for (const w of Object.values(doc.walls)) {
      const a = doc.nodes[w.a];
      const b = doc.nodes[w.b];
      if (a && b && inR(a.x, a.y) && inR(b.x, b.y)) {
        items.push({ type: "wall", id: w.id });
      }
    }
    for (const f of Object.values(doc.furniture)) {
      if (inR(f.x, f.y)) items.push({ type: "furniture", id: f.id });
    }
    for (const item of Object.values(doc.texts)) {
      if (inR(item.x, item.y)) items.push({ type: "text", id: item.id });
    }
    for (const op of Object.values(doc.doors)) {
      const g = wallGeom(doc, op.wallId);
      if (g && inR(g.ax + g.ux * op.offset, g.ay + g.uy * op.offset)) {
        items.push({ type: "door", id: op.id });
      }
    }
    for (const op of Object.values(doc.windows)) {
      const g = wallGeom(doc, op.wallId);
      if (g && inR(g.ax + g.ux * op.offset, g.ay + g.uy * op.offset)) {
        items.push({ type: "window", id: op.id });
      }
    }
    return items;
  };

  // ---- pointer handlers ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return; // right-drag handled separately
    const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);

    // pan via space or middle button
    if (spaceDown.current || e.button === 1) {
      pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === "wall") {
      const rp = resolvePoint(wx, wy, chainStart);
      if (!chainStart) {
        setChainStart(rp);
      } else {
        const endId = store.addWall(chainStart, rp, DEFAULT_THICKNESS);
        const endNode = doc.nodes[endId] ?? { x: rp.x, y: rp.y };
        setChainStart({
          x: rp.x,
          y: rp.y,
          nodeId: endId,
          snap: rp.snap,
        });
        void endNode;
      }
      return;
    }

    if (tool === "door" || tool === "window") {
      const target = findOpeningTarget(wx, wy);
      if (target) {
        store.addOpening(tool, target.wallId, target.offset);
      }
      return;
    }

    if (tool === "text") {
      const text = window.prompt("Escribe el texto del plano:", "Texto");
      if (text !== null && text.trim()) store.addText(wx, wy, text);
      return;
    }

    if (tool === "measure") {
      setMeasure({ ax: wx, ay: wy, bx: wx, by: wy });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    if (tool === "delete") {
      const hit = hitTest(wx, wy);
      if (hit && hit.type !== "room") {
        store.deleteById(hit.type, hit.id);
      }
      return;
    }

    // select tool

    // rotation handle of the currently selected furniture takes priority
    if (selection?.type === "furniture") {
      const f = doc.furniture[selection.id];
      if (f) {
        const hp = furnitureHandleWorld(f, z);
        if (dist(wx, wy, hp.x, hp.y) <= 12 / z) {
          drag.current = {
            kind: "furniture-rotate",
            id: f.id,
            moved: false,
            sx: e.clientX,
            sy: e.clientY,
          };
          (e.target as Element).setPointerCapture?.(e.pointerId);
          return;
        }
      }
    }

    const hit = hitTest(wx, wy);
    if (!hit) {
      // empty canvas → start a rubber-band marquee selection
      setSelection(null);
      marqueeActive.current = true;
      setMarquee({ ax: wx, ay: wy, bx: wx, by: wy });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }
    setSelection(hit);
    if (hit && hit.type === "furniture") {
      const f = doc.furniture[hit.id];
      drag.current = {
        kind: "furniture",
        id: hit.id,
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
        ox: f ? wx - f.x : 0,
        oy: f ? wy - f.y : 0,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (hit && hit.type === "node") {
      drag.current = {
        kind: "node",
        id: hit.id,
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (hit && (hit.type === "door" || hit.type === "window")) {
      drag.current = {
        kind: "opening",
        id: hit.id,
        openingKind: hit.type,
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (hit && hit.type === "text") {
      const item = doc.texts[hit.id];
      drag.current = {
        kind: "text",
        id: hit.id,
        moved: false,
        sx: e.clientX,
        sy: e.clientY,
        ox: item ? wx - item.x : 0,
        oy: item ? wy - item.y : 0,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const { x: wx, y: wy } = toWorld(e.clientX, e.clientY);
    setCursor({ x: wx, y: wy });

    if (pan.current) {
      setView({
        z,
        tx: pan.current.tx + (e.clientX - pan.current.x),
        ty: pan.current.ty + (e.clientY - pan.current.y),
      });
      return;
    }

    if (measure) {
      setMeasure({ ...measure, bx: wx, by: wy });
      return;
    }

    if (marqueeActive.current && marqueeRef.current) {
      setMarquee({ ...marqueeRef.current, bx: wx, by: wy });
      return;
    }

    const d = drag.current;
    if (d) {
      // Ignore sub-threshold jitter so a bare click never starts a drag.
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < DRAG_THRESHOLD) {
          return;
        }
        // Start exactly one history entry on the first real drag movement.
        d.moved = true;
        store.beginChange();
      }
      if (d.kind === "furniture") {
        let nx = wx - (d.ox ?? 0);
        let ny = wy - (d.oy ?? 0);
        if (settings.gridSnap) {
          const g = snapToGrid(nx, ny, gridMinorStep(settings.unit));
          nx = g.x;
          ny = g.y;
        }
        store.setFurnitureLive(d.id, { x: nx, y: ny });
      } else if (d.kind === "furniture-rotate") {
        const f = doc.furniture[d.id];
        if (f) {
          let deg = angleDeg(f.x, f.y, wx, wy) + 90;
          if (settings.angleSnap) deg = Math.round(deg / 15) * 15;
          deg = ((deg % 360) + 360) % 360;
          store.setFurnitureLive(d.id, { rotation: deg });
        }
      } else if (d.kind === "node") {
        const rp = resolvePoint(wx, wy, null);
        store.setNodePos(d.id, rp.x, rp.y);
      } else if (d.kind === "text") {
        store.setTextLive(d.id, { x: wx - (d.ox ?? 0), y: wy - (d.oy ?? 0) });
      } else if (d.openingKind) {
        const op =
          d.openingKind === "door" ? doc.doors[d.id] : doc.windows[d.id];
        if (op) {
          const g = wallGeom(doc, op.wallId);
          if (g) {
            const c = closestPointOnSegment(wx, wy, g.ax, g.ay, g.bx, g.by);
            store.setOpeningLive(d.openingKind, d.id, { offset: c.t * g.len });
          }
        }
      }
    }
  };

  const endInteraction = (e: React.PointerEvent) => {
    if (marqueeActive.current) {
      marqueeActive.current = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      const m = marqueeRef.current;
      if (m) {
        const screenW = Math.abs(m.bx - m.ax) * z;
        const screenH = Math.abs(m.by - m.ay) * z;
        // A bare click (tiny box) just clears selection.
        if (screenW >= DRAG_THRESHOLD || screenH >= DRAG_THRESHOLD) {
          setMultiSelection(itemsInRect(m.ax, m.ay, m.bx, m.by));
        }
      }
      setMarquee(null);
      return;
    }
    if (pan.current) {
      pan.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
    if (drag.current) {
      drag.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
    if (measure && tool === "measure") {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
  };

  // right-drag pan + suppress context menu
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };
  const onMouseDownCapture = (e: React.MouseEvent) => {
    if (e.button === 2) {
      pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      const move = (ev: MouseEvent) => {
        if (!pan.current) return;
        setView({
          z,
          tx: pan.current.tx + (ev.clientX - pan.current.x),
          ty: pan.current.ty + (ev.clientY - pan.current.y),
        });
      };
      const up = () => {
        pan.current = null;
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }
  };

  // ---- preview wall ----
  const previewEnd =
    tool === "wall" && chainStart && cursor
      ? resolvePoint(cursor.x, cursor.y, chainStart)
      : null;

  const inv = 1 / z; // counter-scale factor for text/handles

  const gridStep = gridMajorStep(settings.unit);
  const showGrid = settings.gridVisible && z * gridStep >= 6;

  // visible world bounds for grid
  const vx0 = -view.tx / z;
  const vy0 = -view.ty / z;
  const vx1 = (size.w - view.tx) / z;
  const vy1 = (size.h - view.ty) / z;

  // very subtle minor sub-grid (1 dm metric / 1 in imperial), only when zoomed in enough to be legible
  const subStep = gridMinorStep(settings.unit);
  const showSubGrid =
    settings.gridVisible && subStep < gridStep && z * subStep >= 7;
  const subGridLines: React.ReactNode[] = [];
  if (showSubGrid) {
    const sX = Math.floor(vx0 / subStep) * subStep;
    const sY = Math.floor(vy0 / subStep) * subStep;
    for (let x = sX; x <= vx1; x += subStep) {
      if (Math.abs(x / gridStep - Math.round(x / gridStep)) < 1e-6) continue; // skip main-grid overlaps
      subGridLines.push(
        <line
          key={`sx${x}`}
          x1={x}
          y1={vy0}
          x2={x}
          y2={vy1}
          stroke="#f6f6f6"
          strokeWidth={inv * 0.5}
        />,
      );
    }
    for (let y = sY; y <= vy1; y += subStep) {
      if (Math.abs(y / gridStep - Math.round(y / gridStep)) < 1e-6) continue;
      subGridLines.push(
        <line
          key={`sy${y}`}
          x1={vx0}
          y1={y}
          x2={vx1}
          y2={y}
          stroke="#f6f6f6"
          strokeWidth={inv * 0.5}
        />,
      );
    }
  }

  const gridLines: React.ReactNode[] = [];
  if (showGrid) {
    const startX = Math.floor(vx0 / gridStep) * gridStep;
    const startY = Math.floor(vy0 / gridStep) * gridStep;
    for (let x = startX; x <= vx1; x += gridStep) {
      const major = Math.round(x / gridStep) % 5 === 0;
      gridLines.push(
        <line
          key={`gx${x}`}
          x1={x}
          y1={vy0}
          x2={x}
          y2={vy1}
          stroke={major ? "#e2e2e2" : "#efefef"}
          strokeWidth={inv}
        />,
      );
    }
    for (let y = startY; y <= vy1; y += gridStep) {
      const major = Math.round(y / gridStep) % 5 === 0;
      gridLines.push(
        <line
          key={`gy${y}`}
          x1={vx0}
          y1={y}
          x2={vx1}
          y2={y}
          stroke={major ? "#e2e2e2" : "#efefef"}
          strokeWidth={inv}
        />,
      );
    }
  }

  const dims = settings.labelsVisible ? dimensionLabels(doc) : [];
  const jointList = joints(doc);

  const cursorClass =
    tool === "select"
      ? "csr-default"
      : tool === "delete"
        ? "csr-delete"
        : "csr-cross";

  return (
    <svg
      ref={svgRef}
      className={`canvas ${cursorClass}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endInteraction}
      onPointerLeave={endInteraction}
      onContextMenu={onContextMenu}
      onMouseDownCapture={onMouseDownCapture}
    >
      <g transform={`translate(${view.tx} ${view.ty}) scale(${z})`}>
        {subGridLines}
        {gridLines}

        {/* rooms */}
        {rooms.map((r) => {
          const sel = selection?.type === "room" && selection.id === r.id;
          return (
            <g key={r.id}>
              <polygon
                points={r.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={sel ? "#e9eef5" : "#f5f5f5"}
              />
              {settings.labelsVisible && (
                <text
                  x={r.centroid.x}
                  y={r.centroid.y}
                  fontSize={13 * inv}
                  textAnchor="middle"
                  className="room-label"
                >
                  {formatArea(r.area, settings.unit)}
                </text>
              )}
            </g>
          );
        })}

        {/* walls */}
        {Object.keys(doc.walls).map((id, index) => {
          const w = doc.walls[id];
          const sel =
            (selection?.type === "wall" && selection.id === id) ||
            inMulti("wall", id);
          const gradientId = `wall-gradient-${index}`;
          const color = safeColor(w.color, DEFAULT_STROKE);
          const stroke = sel
            ? "#2563eb"
            : w.gradientColor
              ? `url(#${gradientId})`
              : color;
          return (
            <g key={id} style={effectStyle(w.effect, color)}>
              {w.gradientColor && !sel && (
                <GradientDefs
                  id={gradientId}
                  start={color}
                  end={safeColor(w.gradientColor)}
                />
              )}
              {wallSegments(doc, id).map((s, i) => (
                <line
                  key={i}
                  x1={s.x1}
                  y1={s.y1}
                  x2={s.x2}
                  y2={s.y2}
                  stroke={stroke}
                  strokeWidth={w.thickness}
                  strokeLinecap="butt"
                />
              ))}
            </g>
          );
        })}

        {/* joints */}
        {jointList.map((j, i) => (
          <rect
            key={i}
            x={j.x - j.size / 2}
            y={j.y - j.size / 2}
            width={j.size}
            height={j.size}
            fill="#111111"
          />
        ))}

        {/* windows */}
        {Object.values(doc.windows).map((op, index) => {
          const wn = windowSymbol(doc, op);
          if (!wn) return null;
          const sel =
            (selection?.type === "window" && selection.id === op.id) ||
            inMulti("window", op.id);
          const o1 = wn.thickness / 2;
          const color = safeColor(op.color, DEFAULT_STROKE);
          const gradientId = `window-gradient-${index}`;
          const col = sel
            ? "#2563eb"
            : op.gradientColor
              ? `url(#${gradientId})`
              : color;
          return (
            <g key={op.id} style={effectStyle(op.effect, color)}>
              {op.gradientColor && !sel && (
                <GradientDefs
                  id={gradientId}
                  start={color}
                  end={safeColor(op.gradientColor)}
                />
              )}
              <JambCaps op={op} doc={doc} color={col} />
              <line
                x1={wn.j1x + wn.nx * o1}
                y1={wn.j1y + wn.ny * o1}
                x2={wn.j2x + wn.nx * o1}
                y2={wn.j2y + wn.ny * o1}
                stroke={col}
                strokeWidth={1.5 * inv}
              />
              <line
                x1={wn.j1x - wn.nx * o1}
                y1={wn.j1y - wn.ny * o1}
                x2={wn.j2x - wn.nx * o1}
                y2={wn.j2y - wn.ny * o1}
                stroke={col}
                strokeWidth={1.5 * inv}
              />
            </g>
          );
        })}

        {/* doors */}
        {Object.values(doc.doors).map((op, index) => {
          const d = doorSymbol(doc, op);
          if (!d) return null;
          const sel =
            (selection?.type === "door" && selection.id === op.id) ||
            inMulti("door", op.id);
          const color = safeColor(op.color, DEFAULT_STROKE);
          const gradientId = `door-gradient-${index}`;
          const col = sel
            ? "#2563eb"
            : op.gradientColor
              ? `url(#${gradientId})`
              : color;
          return (
            <g key={op.id} style={effectStyle(op.effect, color)}>
              {op.gradientColor && !sel && (
                <GradientDefs
                  id={gradientId}
                  start={color}
                  end={safeColor(op.gradientColor)}
                />
              )}
              <JambCaps op={op} doc={doc} color={col} />
              <line
                x1={d.hingeX}
                y1={d.hingeY}
                x2={d.lx}
                y2={d.ly}
                stroke={col}
                strokeWidth={1.5 * inv}
              />
              <path
                d={`M ${d.arcStartX} ${d.arcStartY} A ${d.r} ${d.r} 0 0 ${d.sweep} ${d.arcEndX} ${d.arcEndY}`}
                fill="none"
                stroke={col}
                strokeWidth={inv}
              />
            </g>
          );
        })}

        {/* furniture */}
        {Object.values(doc.furniture).map((f, index) => {
          const single =
            selection?.type === "furniture" && selection.id === f.id;
          const sel = single || inMulti("furniture", f.id);
          const color = safeColor(f.color, DEFAULT_STROKE);
          const strokeGradientId = `furniture-stroke-gradient-${index}`;
          const fillGradientId = `furniture-fill-gradient-${index}`;
          const col = sel
            ? "#2563eb"
            : f.gradientColor
              ? `url(#${strokeGradientId})`
              : color;
          const fill =
            f.gradientColor && !sel
              ? `url(#${fillGradientId})`
              : f.fillColor
                ? safeColor(f.fillColor, DEFAULT_FURNITURE_FILL)
                : undefined;
          const prims = furnitureSymbol(f.kind, f.w, f.h);
          return (
            <g
              key={f.id}
              transform={`translate(${f.x} ${f.y}) rotate(${f.rotation})`}
              style={effectStyle(f.effect, color)}
            >
              {f.gradientColor && !sel && (
                <>
                  <GradientDefs
                    id={strokeGradientId}
                    start={color}
                    end={safeColor(f.gradientColor)}
                  />
                  <GradientDefs
                    id={fillGradientId}
                    start={safeColor(f.fillColor, DEFAULT_FURNITURE_FILL)}
                    end={safeColor(f.gradientColor)}
                  />
                </>
              )}
              {renderPrims(prims, col, 1.4 * inv, fill)}
              {f.label && (
                <text
                  x={0}
                  y={0}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="Inter, sans-serif"
                  fontSize={Math.max(8, Math.min(f.w, f.h) * 0.18)}
                  fill={safeColor(f.color, DEFAULT_STROKE)}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {f.label}
                </text>
              )}
              {sel && (
                <>
                  <rect
                    x={-f.w / 2}
                    y={-f.h / 2}
                    width={f.w}
                    height={f.h}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={inv}
                    strokeDasharray={`${4 * inv} ${3 * inv}`}
                  />
                  {single && (
                    <>
                      <line
                        x1={0}
                        y1={-f.h / 2}
                        x2={0}
                        y2={-f.h / 2 - ROT_HANDLE_DIST * inv}
                        stroke="#2563eb"
                        strokeWidth={inv}
                      />
                      <circle
                        cx={0}
                        cy={-f.h / 2 - ROT_HANDLE_DIST * inv}
                        r={5 * inv}
                        fill="#fff"
                        stroke="#2563eb"
                        strokeWidth={1.5 * inv}
                      />
                    </>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* textos añadidos */}
        {Object.values(doc.texts).map((item, index) => {
          const selected =
            selection?.type === "text" && selection.id === item.id;
          const color = safeColor(item.color, DEFAULT_STROKE);
          const gradientId = `text-gradient-${index}`;
          const fill = item.gradientColor
            ? `url(#${gradientId})`
            : color;
          return (
            <g
              key={item.id}
              transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
              style={effectStyle(item.effect, color)}
            >
              {item.gradientColor && (
                <GradientDefs
                  id={gradientId}
                  start={color}
                  end={safeColor(item.gradientColor)}
                />
              )}
              <text
                x={0}
                y={0}
                fontSize={item.fontSize}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="Inter, sans-serif"
                fill={fill}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {item.text}
              </text>
              {selected && (
                <rect
                  x={-Math.max(item.fontSize, item.text.length * item.fontSize * 0.62) / 2}
                  y={-item.fontSize}
                  width={Math.max(item.fontSize, item.text.length * item.fontSize * 0.62)}
                  height={item.fontSize * 2}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth={inv}
                  strokeDasharray={`${4 * inv} ${3 * inv}`}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {/* preview wall */}
        {previewEnd && chainStart && (
          <>
            <line
              x1={chainStart.x}
              y1={chainStart.y}
              x2={previewEnd.x}
              y2={previewEnd.y}
              stroke="#2563eb"
              strokeWidth={DEFAULT_THICKNESS}
              opacity={0.4}
              strokeLinecap="butt"
            />
            <PreviewLabel from={chainStart} to={previewEnd} inv={inv} unit={settings.unit} />
          </>
        )}

        {/* chain start dot */}
        {tool === "wall" && chainStart && (
          <circle
            cx={chainStart.x}
            cy={chainStart.y}
            r={4 * inv}
            fill="#2563eb"
          />
        )}

        {/* snap indicator */}
        {tool === "wall" && previewEnd?.snap === "node" && (
          <circle
            cx={previewEnd.x}
            cy={previewEnd.y}
            r={6 * inv}
            fill="none"
            stroke="#2563eb"
            strokeWidth={1.5 * inv}
          />
        )}

        {/* dimension labels */}
        {dims.map((dm, i) => (
          <text
            key={i}
            x={dm.x}
            y={dm.y}
            fontSize={12 * inv}
            textAnchor="middle"
            className="dim-label"
          >
            {formatLen(dm.len, settings.unit)}
          </text>
        ))}

        {/* selection handles for nodes */}
        {Object.values(doc.nodes).map((n) => {
          const sel = selection?.type === "node" && selection.id === n.id;
          if (!sel) return null;
          return (
            <rect
              key={n.id}
              x={n.x - 5 * inv}
              y={n.y - 5 * inv}
              width={10 * inv}
              height={10 * inv}
              fill="#fff"
              stroke="#2563eb"
              strokeWidth={1.5 * inv}
            />
          );
        })}

        {/* marquee selection box */}
        {marquee && (
          <rect
            x={Math.min(marquee.ax, marquee.bx)}
            y={Math.min(marquee.ay, marquee.by)}
            width={Math.abs(marquee.bx - marquee.ax)}
            height={Math.abs(marquee.by - marquee.ay)}
            fill="#2563eb"
            fillOpacity={0.06}
            stroke="#2563eb"
            strokeWidth={inv}
            strokeDasharray={`${4 * inv} ${3 * inv}`}
          />
        )}

        {/* measure overlay */}
        {measure && (
          <g>
            <line
              x1={measure.ax}
              y1={measure.ay}
              x2={measure.bx}
              y2={measure.by}
              stroke="#2563eb"
              strokeWidth={1.5 * inv}
              strokeDasharray={`${4 * inv} ${4 * inv}`}
            />
            <MeasureLabel m={measure} inv={inv} unit={settings.unit} />
          </g>
        )}
      </g>
    </svg>
  );
}

// Transform a world point into a furniture's local (un-rotated, centred) frame.
function toFurnitureLocal(
  f: Furniture,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const rad = (f.rotation * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = wx - f.x;
  const dy = wy - f.y;
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}

function toTextLocal(
  item: TextItem,
  wx: number,
  wy: number,
): { x: number; y: number } {
  const rad = (item.rotation * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = wx - item.x;
  const dy = wy - item.y;
  return { x: c * dx + s * dy, y: -s * dx + c * dy };
}

function GradientDefs({
  id,
  start,
  end,
}: {
  id: string;
  start: string;
  end: string;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={start} />
        <stop offset="100%" stopColor={end} />
      </linearGradient>
    </defs>
  );
}

// World position of the rotation handle above a furniture item.
function furnitureHandleWorld(
  f: Furniture,
  z: number,
): { x: number; y: number } {
  const rad = (f.rotation * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const ly = -f.h / 2 - ROT_HANDLE_DIST / z;
  // local (0, ly) rotated into world
  return { x: f.x - s * ly, y: f.y + c * ly };
}

function renderPrims(
  prims: Prim[],
  stroke: string,
  sw: number,
  fillOverride?: string,
): React.ReactNode[] {
  const getFill = (fill: string | undefined) => {
    const normalized = fill?.toLowerCase();
    const isWhite =
      normalized === "#fff" ||
      normalized === "#ffffff" ||
      normalized === "white";
    return isWhite && fillOverride ? fillOverride : (fill ?? "none");
  };
  return prims.map((p, i) => {
    switch (p.t) {
      case "rect":
        return (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={p.w}
            height={p.h}
            rx={p.rx}
            fill={getFill(p.fill)}
            stroke={stroke}
            strokeWidth={sw}
          />
        );
      case "line":
        return (
          <line
            key={i}
            x1={p.x1}
            y1={p.y1}
            x2={p.x2}
            y2={p.y2}
            stroke={stroke}
            strokeWidth={sw}
          />
        );
      case "circle":
        return (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r={p.r}
            fill={getFill(p.fill)}
            stroke={stroke}
            strokeWidth={sw}
          />
        );
      case "ellipse":
        return (
          <ellipse
            key={i}
            cx={p.cx}
            cy={p.cy}
            rx={p.rx}
            ry={p.ry}
            fill={getFill(p.fill)}
            stroke={stroke}
            strokeWidth={sw}
          />
        );
      case "path":
        return (
          <path
            key={i}
            d={p.d}
            fill={getFill(p.fill)}
            stroke={stroke}
            strokeWidth={sw}
          />
        );
      case "polyline": {
        const pts: string[] = [];
        for (let j = 0; j < p.pts.length; j += 2) {
          pts.push(`${p.pts[j]},${p.pts[j + 1]}`);
        }
        return (
          <polyline
            key={i}
            points={pts.join(" ")}
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
          />
        );
      }
    }
  });
}

function pointInPoly(
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

function JambCaps({
  op,
  doc,
  color,
}: {
  op: import("../types").Opening;
  doc: import("../types").Doc;
  color: string;
}) {
  const g = wallGeom(doc, op.wallId);
  if (!g) return null;
  const o = g.thickness / 2;
  const t1 = op.offset - op.width / 2;
  const t2 = op.offset + op.width / 2;
  const p1x = g.ax + g.ux * t1;
  const p1y = g.ay + g.uy * t1;
  const p2x = g.ax + g.ux * t2;
  const p2y = g.ay + g.uy * t2;
  return (
    <g>
      <line
        x1={p1x + g.nx * o}
        y1={p1y + g.ny * o}
        x2={p1x - g.nx * o}
        y2={p1y - g.ny * o}
        stroke={color}
        strokeWidth={1.5 / 1}
      />
      <line
        x1={p2x + g.nx * o}
        y1={p2y + g.ny * o}
        x2={p2x - g.nx * o}
        y2={p2y - g.ny * o}
        stroke={color}
        strokeWidth={1.5 / 1}
      />
    </g>
  );
}

function PreviewLabel({
  from,
  to,
  inv,
  unit,
}: {
  from: ResolvedPoint;
  to: ResolvedPoint;
  inv: number;
  unit: import("../types").Unit;
}) {
  const len = dist(from.x, from.y, to.x, to.y);
  if (len < 1) return null;
  const deg = ((angleDeg(from.x, from.y, to.x, to.y) % 360) + 360) % 360;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  return (
    <text
      x={mx}
      y={my - 10 * inv}
      fontSize={12 * inv}
      textAnchor="middle"
      className="measure-text"
    >
      {formatLen(len, unit)} · {Math.round(deg)}°
    </text>
  );
}

function MeasureLabel({
  m,
  inv,
  unit,
}: {
  m: MeasureState;
  inv: number;
  unit: import("../types").Unit;
}) {
  const len = dist(m.ax, m.ay, m.bx, m.by);
  const mx = (m.ax + m.bx) / 2;
  const my = (m.ay + m.by) / 2;
  return (
    <text
      x={mx}
      y={my - 8 * inv}
      fontSize={12 * inv}
      textAnchor="middle"
      className="measure-text"
    >
      {formatLen(len, unit)}
    </text>
  );
}
