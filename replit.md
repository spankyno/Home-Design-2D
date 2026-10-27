# Floor Plan Editor

A minimalist, fast, precise single-page floor plan editor (Figma + AutoCAD + Notion feel): draw walls, auto-detect rooms with areas, place doors/windows, and export — all in the browser with no backend.

## Run & Operate

- App runs via the `artifacts/floorplan: web` workflow (Vite dev server).
- `pnpm --filter @workspace/floorplan run typecheck` — typecheck the editor
- Frontend-only editor: no auth or database; state persists in `localStorage` (`floorplan:v1`). Export PNG/PDF/JSON is client-side.

## Stack

- React 19 + Vite 7, TypeScript
- SVG-based canvas (no external canvas/drawing libs)
- `lucide-react` for icons, `jspdf` for PDF export
- pnpm workspaces, Node.js 24

## Where things live

All under `artifacts/floorplan/src/`:

- `types.ts` — core data model (`Node`/`Wall`/`Opening`/`Doc`/`Settings`/`View`/`Selection`/`RoomInfo`). World units are **cm** (100 cm = 1 m).
- `store.tsx` — React context store: doc state, undo/redo history, autosave, and all mutation actions.
- `components/CanvasView.tsx` — the SVG canvas: pan/zoom, wall-drawing chain, hit-testing, drag, measure tool.
- `components/Toolbar.tsx` — left vertical tool icons. `components/PropertiesPanel.tsx` — right floating panel (only when something is selected).
- `lib/geometry.ts` — vector math, angle/grid snapping, polygon area/centroid, point-in-polygon.
- `lib/rooms.ts` — planar half-edge face detection → rooms.
- `lib/render.ts` — shared SVG primitives (wall segments minus openings, door/window symbols, joints, dimension labels).
- `lib/exporters.ts` — PNG/PDF/JSON export and JSON import. `lib/persistence.ts` — localStorage load/save. `lib/units.ts` — cm/m formatting.

## Architecture decisions

- **World coordinates are cm**; the SVG `<g>` applies `translate(tx,ty) scale(z)`. Text/handles are counter-scaled by `1/z` so they stay constant on screen at any zoom.
- **Walls are node-graph edges** (`Wall.a`/`Wall.b` reference `Node` ids), not free segments. This makes joints, room detection, and joint-locked editing possible.
- **Rooms are derived, never stored** — recomputed via half-edge traversal on every doc change (`useMemo`). Bounded faces have positive signed area in screen coords; the outer face is discarded.
- **Doors/windows store an `offset` + `width` along their wall** and visually cut the wall by splitting it into solid segments around the opening gap.
- **Undo/redo uses synchronous refs** (`docRef`/`pastRef`/`futureRef`) — see Gotchas.

## Product

Infinite white canvas with toggleable grid; zoom (wheel) and pan (space-drag or right-drag). Tools: Select, Wall (click-click chaining with 0/45/90 angle snap and live length+angle readout), Door, Window, Measure, Delete. Auto room detection fills closed loops grey with m² area. Properties panel allows exact length/angle/position/thickness edits with optional joint locking. Undo/redo (Ctrl+Z / Ctrl+Y), cm/m unit toggle, localStorage autosave, and PNG/PDF/JSON export + JSON import.

## User preferences

- Visual style: detailed architectural line-art. Fine black line work on white fills (CAD plan symbols); furniture is richly detailed via line work, not shading — almost no grey. The only solid fill is black, reserved for foliage (plants/bushes) and piano keys. No shadows/gradients/animations (only smooth drag). Keep it fast and precise.

## Gotchas

- **Undo/redo history must snapshot `docRef.current` eagerly, never inside a deferred functional state updater.** `setDoc` mutates `docRef.current` synchronously, so a `setPast((p) => [...p, docRef.current])` updater runs later and captures the *post*-mutation doc, corrupting history. `store.tsx` mirrors doc + past + future in refs and reads them synchronously in `beginChange`/`undo`/`redo`.
- Drags begin one history entry only after the pointer moves past `DRAG_THRESHOLD` (3px), so a bare click never pushes a no-op undo. Live drag mutations use non-committing setters (`setNodePos`, `setOpeningLive`); the panel uses committing variants.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
