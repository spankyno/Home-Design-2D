import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Doc,
  Settings,
  View,
  Tool,
  Selection,
  SelItem,
  RoomInfo,
  ResolvedPoint,
  Node,
  Wall,
  Opening,
  Furniture,
  TextItem,
  ObjectStyle,
} from "./types";
import { loadState, saveState } from "./lib/persistence";
import { detectRooms } from "./lib/rooms";
import { wallGeom } from "./lib/render";
import { dist } from "./lib/geometry";
import { furnitureDef } from "./lib/furniture";

let counter = 0;
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;
}

interface StoreValue {
  doc: Doc;
  rooms: RoomInfo[];
  settings: Settings;
  view: View;
  tool: Tool;
  selection: Selection;
  multiSelection: SelItem[];
  canUndo: boolean;
  canRedo: boolean;

  setTool: (t: Tool) => void;
  setSelection: (s: Selection) => void;
  setMultiSelection: (items: SelItem[]) => void;
  setSettings: (patch: Partial<Settings>) => void;
  setView: (v: View | ((prev: View) => View)) => void;

  beginChange: () => void;
  update: (mutator: (d: Doc) => Doc) => void;
  undo: () => void;
  redo: () => void;

  canvasSize: { w: number; h: number };
  setCanvasSize: (s: { w: number; h: number }) => void;

  addWall: (
    from: ResolvedPoint,
    to: ResolvedPoint,
    thickness: number,
  ) => string;
  addOpening: (kind: "door" | "window", wallId: string, offset: number) => void;
  addFurnitureAtViewCenter: (kind: string) => void;
  addText: (x: number, y: number, text: string) => void;
  setFurniture: (
    id: string,
    patch: Partial<{
      x: number;
      y: number;
      rotation: number;
      w: number;
      h: number;
      label: string;
      color: string;
      gradientColor: string;
      fillColor: string;
      effect: ObjectStyle["effect"];
    }>,
  ) => void;
  setFurnitureLive: (
    id: string,
    patch: Partial<{
      x: number;
      y: number;
      rotation: number;
      w: number;
      h: number;
      label: string;
      color: string;
      gradientColor: string;
      fillColor: string;
      effect: ObjectStyle["effect"];
    }>,
  ) => void;
  setText: (id: string, patch: Partial<TextItem>) => void;
  setTextLive: (id: string, patch: Partial<TextItem>) => void;
  setAppearance: (
    type: "wall" | "door" | "window" | "furniture" | "text",
    id: string,
    patch: Partial<ObjectStyle>,
  ) => void;
  setAppearanceLive: (
    type: "wall" | "door" | "window" | "furniture" | "text",
    id: string,
    patch: Partial<ObjectStyle>,
  ) => void;
  reorderFurniture: (id: string, to: "front" | "back" | "forward" | "backward") => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  deleteById: (
    type: "wall" | "node" | "door" | "window" | "furniture" | "text",
    id: string,
  ) => void;
  deleteMany: (items: SelItem[]) => void;
  setNodePos: (id: string, x: number, y: number) => void;
  setNodePosCommitted: (id: string, x: number, y: number) => void;
  setWallThickness: (id: string, thickness: number) => void;
  setWallLength: (id: string, lengthCm: number) => void;
  setWallAngle: (id: string, deg: number) => void;
  setOpening: (
    kind: "door" | "window",
    id: string,
    patch: { width?: number; offset?: number; flipX?: boolean; flipY?: boolean },
  ) => void;
  setOpeningLive: (
    kind: "door" | "window",
    id: string,
    patch: { width?: number; offset?: number; flipX?: boolean; flipY?: boolean },
  ) => void;
  replaceDoc: (d: Doc) => void;
  clearAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

const DEFAULT_DOOR_WIDTH = 90;
const DEFAULT_WINDOW_WIDTH = 100;
const HISTORY_LIMIT = 100;
const PASTE_OFFSET = 30; // cm, diagonal nudge applied to pasted copies

type Clipboard = {
  nodes: Node[];
  walls: Wall[];
  doors: Opening[];
  windows: Opening[];
  furniture: Furniture[];
  texts: TextItem[];
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(() => loadState(), []);
  const [doc, setDocState] = useState<Doc>(initial.doc);
  const [settings, setSettingsState] = useState<Settings>(initial.settings);
  const [view, setView] = useState<View>({ z: 1, tx: 400, ty: 300 });
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelectionState] = useState<Selection>(null);
  const [multiSelection, setMultiSelectionState] = useState<SelItem[]>([]);

  const setSelection = (s: Selection) => {
    setSelectionState(s);
    setMultiSelectionState([]);
  };
  const setMultiSelection = (items: SelItem[]) => {
    setSelectionState(null);
    setMultiSelectionState(items);
  };
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [past, setPast] = useState<Doc[]>([]);
  const [future, setFuture] = useState<Doc[]>([]);

  // Refs mirror the latest doc/history so that synchronous multi-step actions
  // (beginChange + setDoc, undo, redo) never read a stale or already-mutated
  // value. Functional state updaters run deferred, so capturing docRef inside
  // them would observe the post-mutation doc — hence we snapshot eagerly here.
  const docRef = useRef(doc);
  const pastRef = useRef<Doc[]>([]);
  const futureRef = useRef<Doc[]>([]);
  const clipboardRef = useRef<Clipboard | null>(null);
  const pasteCountRef = useRef(0);

  const setDoc = (next: Doc) => {
    docRef.current = next;
    setDocState(next);
  };
  const setPastBoth = (next: Doc[]) => {
    pastRef.current = next;
    setPast(next);
  };
  const setFutureBoth = (next: Doc[]) => {
    futureRef.current = next;
    setFuture(next);
  };

  // autosave (debounced)
  useEffect(() => {
    const t = setTimeout(() => saveState(doc, settings), 300);
    return () => clearTimeout(t);
  }, [doc, settings]);

  const rooms = useMemo(() => detectRooms(doc), [doc]);

  const beginChange = () => {
    const snapshot = docRef.current;
    const next = [...pastRef.current, snapshot];
    if (next.length > HISTORY_LIMIT) next.shift();
    setPastBoth(next);
    setFutureBoth([]);
  };

  const update = (mutator: (d: Doc) => Doc) => {
    setDoc(mutator(docRef.current));
  };

  const commit = (mutator: (d: Doc) => Doc) => {
    beginChange();
    setDoc(mutator(docRef.current));
  };

  const undo = () => {
    const p = pastRef.current;
    if (p.length === 0) return;
    const prev = p[p.length - 1];
    const current = docRef.current;
    setPastBoth(p.slice(0, -1));
    setFutureBoth([current, ...futureRef.current]);
    setDoc(prev);
    setSelection(null);
  };

  const redo = () => {
    const f = futureRef.current;
    if (f.length === 0) return;
    const next = f[0];
    const current = docRef.current;
    setFutureBoth(f.slice(1));
    setPastBoth([...pastRef.current, current]);
    setDoc(next);
    setSelection(null);
  };

  const setSettings = (patch: Partial<Settings>) =>
    setSettingsState((s) => ({ ...s, ...patch }));

  const createNode = (nodes: Record<string, Doc["nodes"][string]>, p: {
    x: number;
    y: number;
  }): string => {
    const id = uid("n");
    nodes[id] = { id, x: p.x, y: p.y };
    return id;
  };

  const wallLength = (d: Doc, wallId: string): number => {
    const w = d.walls[wallId];
    if (!w) return 0;
    const a = d.nodes[w.a];
    const b = d.nodes[w.b];
    if (!a || !b) return 0;
    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  const addWall: StoreValue["addWall"] = (from, to, thickness) => {
    const d = docRef.current;
    const nodes = { ...d.nodes };
    const startId = from.nodeId ?? createNode(nodes, from);
    const endId = to.nodeId ?? createNode(nodes, to);
    if (startId === endId) return endId;
    // avoid duplicate wall
    const dup = Object.values(d.walls).some(
      (w) =>
        (w.a === startId && w.b === endId) ||
        (w.a === endId && w.b === startId),
    );
    if (dup) return endId;
    const w = { id: uid("w"), a: startId, b: endId, thickness };
    beginChange();
    setDoc({ ...d, nodes, walls: { ...d.walls, [w.id]: w } });
    return endId;
  };

  const addOpening: StoreValue["addOpening"] = (kind, wallId, offset) => {
    const d = docRef.current;
    const g = wallGeom(d, wallId);
    if (!g) return;
    const width = kind === "door" ? DEFAULT_DOOR_WIDTH : DEFAULT_WINDOW_WIDTH;
    const clampedW = Math.min(width, Math.max(20, g.len - 4));
    const off = Math.max(
      clampedW / 2,
      Math.min(g.len - clampedW / 2, offset),
    );
    const id = uid(kind === "door" ? "d" : "win");
    const op = { id, wallId, offset: off, width: clampedW };
    const key = kind === "door" ? "doors" : "windows";
    commit((cur) => ({ ...cur, [key]: { ...cur[key], [id]: op } }));
  };

  const addFurnitureAtViewCenter: StoreValue["addFurnitureAtViewCenter"] = (
    kind,
  ) => {
    const def = furnitureDef(kind);
    if (!def) return;
    const wx = (canvasSize.w / 2 - view.tx) / view.z;
    const wy = (canvasSize.h / 2 - view.ty) / view.z;
    const id = uid("f");
    const item: Furniture = {
      id,
      kind,
      x: wx,
      y: wy,
      rotation: 0,
      w: def.w,
      h: def.h,
      ...(kind === "custom" ? { label: "Label" } : {}),
    };
    commit((d) => ({ ...d, furniture: { ...d.furniture, [id]: item } }));
    setTool("select");
    setSelection({ type: "furniture", id });
  };

  const addText: StoreValue["addText"] = (x, y, text) => {
    const id = uid("txt");
    const item: TextItem = {
      id,
      text: text.trim() || "Texto",
      x,
      y,
      rotation: 0,
      fontSize: 20,
    };
    commit((d) => ({ ...d, texts: { ...d.texts, [id]: item } }));
    setTool("select");
    setSelection({ type: "text", id });
  };

  const applyFurniture = (
    d: Doc,
    id: string,
    patch: Partial<{
      x: number;
      y: number;
      rotation: number;
      w: number;
      h: number;
      label: string;
      color: string;
      gradientColor: string;
      fillColor: string;
      effect: ObjectStyle["effect"];
    }>,
  ): Doc => {
    const f = d.furniture[id];
    if (!f) return d;
    const next = { ...f, ...patch };
    if (patch.w != null) next.w = Math.max(5, patch.w);
    if (patch.h != null) next.h = Math.max(5, patch.h);
    return { ...d, furniture: { ...d.furniture, [id]: next } };
  };

  const setFurniture: StoreValue["setFurniture"] = (id, patch) => {
    commit((d) => applyFurniture(d, id, patch));
  };

  const setFurnitureLive: StoreValue["setFurnitureLive"] = (id, patch) => {
    update((d) => applyFurniture(d, id, patch));
  };

  const applyText = (d: Doc, id: string, patch: Partial<TextItem>): Doc => {
    const item = d.texts[id];
    if (!item) return d;
    const next = { ...item, ...patch };
    if (patch.fontSize != null) next.fontSize = Math.max(4, patch.fontSize);
    return { ...d, texts: { ...d.texts, [id]: next } };
  };

  const setText: StoreValue["setText"] = (id, patch) => {
    commit((d) => applyText(d, id, patch));
  };

  const setTextLive: StoreValue["setTextLive"] = (id, patch) => {
    update((d) => applyText(d, id, patch));
  };

  const applyAppearance = (
    d: Doc,
    type: "wall" | "door" | "window" | "furniture" | "text",
    id: string,
    patch: Partial<ObjectStyle>,
  ): Doc => {
    if (type === "wall") {
      const item = d.walls[id];
      return item
        ? { ...d, walls: { ...d.walls, [id]: { ...item, ...patch } } }
        : d;
    }
    if (type === "door") {
      const item = d.doors[id];
      return item
        ? { ...d, doors: { ...d.doors, [id]: { ...item, ...patch } } }
        : d;
    }
    if (type === "window") {
      const item = d.windows[id];
      return item
        ? { ...d, windows: { ...d.windows, [id]: { ...item, ...patch } } }
        : d;
    }
    if (type === "furniture") {
      const item = d.furniture[id];
      return item
        ? { ...d, furniture: { ...d.furniture, [id]: { ...item, ...patch } } }
        : d;
    }
    const item = d.texts[id];
    return item
      ? { ...d, texts: { ...d.texts, [id]: { ...item, ...patch } } }
      : d;
  };

  const setAppearance: StoreValue["setAppearance"] = (type, id, patch) => {
    commit((d) => applyAppearance(d, type, id, patch));
  };

  const setAppearanceLive: StoreValue["setAppearanceLive"] = (
    type,
    id,
    patch,
  ) => {
    update((d) => applyAppearance(d, type, id, patch));
  };

  const reorderFurniture: StoreValue["reorderFurniture"] = (id, to) => {
    const ids = Object.keys(docRef.current.furniture);
    const i = ids.indexOf(id);
    if (i === -1) return;
    const target =
      to === "front"
        ? ids.length - 1
        : to === "back"
          ? 0
          : to === "forward"
            ? Math.min(i + 1, ids.length - 1)
            : Math.max(i - 1, 0);
    if (target === i) return;
    commit((d) => {
      const order = Object.keys(d.furniture);
      order.splice(order.indexOf(id), 1);
      order.splice(target, 0, id);
      const furniture: Doc["furniture"] = {};
      for (const k of order) furniture[k] = d.furniture[k];
      return { ...d, furniture };
    });
  };

  const copySelection: StoreValue["copySelection"] = () => {
    const d = docRef.current;
    const items: SelItem[] =
      multiSelection.length > 0
        ? multiSelection
        : selection && selection.type !== "room"
          ? [{ type: selection.type, id: selection.id }]
          : [];
    if (items.length === 0) return;

    const wallIds = new Set<string>();
    const furnIds = new Set<string>();
    const textIds = new Set<string>();
    const doorIds = new Set<string>();
    const winIds = new Set<string>();
    for (const it of items) {
      if (it.type === "wall") wallIds.add(it.id);
      else if (it.type === "furniture") furnIds.add(it.id);
      else if (it.type === "door") doorIds.add(it.id);
      else if (it.type === "window") winIds.add(it.id);
      else if (it.type === "text") textIds.add(it.id);
      // bare nodes are not meaningful to duplicate on their own
    }

    const nodeIds = new Set<string>();
    for (const wid of wallIds) {
      const w = d.walls[wid];
      if (!w) continue;
      nodeIds.add(w.a);
      nodeIds.add(w.b);
    }

    // Openings on a copied wall travel with it; collect those plus any
    // individually-selected openings (deduped).
    const doors: Opening[] = [];
    for (const o of Object.values(d.doors)) {
      if (wallIds.has(o.wallId)) {
        doors.push({ ...o });
        doorIds.delete(o.id);
      }
    }
    for (const id of doorIds) {
      const o = d.doors[id];
      if (o) doors.push({ ...o });
    }
    const windows: Opening[] = [];
    for (const o of Object.values(d.windows)) {
      if (wallIds.has(o.wallId)) {
        windows.push({ ...o });
        winIds.delete(o.id);
      }
    }
    for (const id of winIds) {
      const o = d.windows[id];
      if (o) windows.push({ ...o });
    }

    const clip = {
      nodes: [...nodeIds].map((id) => ({ ...d.nodes[id] })),
      walls: [...wallIds].map((id) => ({ ...d.walls[id] })),
      doors,
      windows,
      furniture: [...furnIds].map((id) => ({ ...d.furniture[id] })),
      texts: [...textIds].map((id) => ({ ...d.texts[id] })),
    };
    if (
      clip.walls.length === 0 &&
      clip.doors.length === 0 &&
      clip.windows.length === 0 &&
      clip.furniture.length === 0
      && clip.texts.length === 0
    )
      return;
    clipboardRef.current = clip;
    pasteCountRef.current = 0;
  };

  const pasteClipboard: StoreValue["pasteClipboard"] = () => {
    const clip = clipboardRef.current;
    if (!clip) return;
    const d = docRef.current;
    const off = PASTE_OFFSET * (pasteCountRef.current + 1);

    const nodes = { ...d.nodes };
    const walls = { ...d.walls };
    const doors = { ...d.doors };
    const windows = { ...d.windows };
    const furniture = { ...d.furniture };
    const texts = { ...d.texts };
    const selItems: SelItem[] = [];

    const nodeMap = new Map<string, string>();
    for (const n of clip.nodes) {
      const nid = uid("n");
      nodeMap.set(n.id, nid);
      nodes[nid] = { id: nid, x: n.x + off, y: n.y + off };
    }
    const wallMap = new Map<string, string>();
    for (const w of clip.walls) {
      const a = nodeMap.get(w.a);
      const b = nodeMap.get(w.b);
      if (!a || !b) continue;
      const wid = uid("w");
      wallMap.set(w.id, wid);
      walls[wid] = { ...w, id: wid, a, b };
      selItems.push({ type: "wall", id: wid });
    }

    const pasteOpenings = (
      list: Opening[],
      bucket: Record<string, Opening>,
      type: "door" | "window",
    ) => {
      for (const o of list) {
        const mapped = wallMap.get(o.wallId);
        const id = uid("o");
        if (mapped) {
          // wall was copied: keep the same offset, it rides the new wall
          bucket[id] = { ...o, id, wallId: mapped };
          selItems.push({ type, id });
        } else if (d.walls[o.wallId]) {
          // standalone opening: re-place on the same wall, nudged & clamped.
          const len = wallLength(d, o.wallId);
          if (len <= 0) continue; // degenerate wall: nothing valid to place
          const width = Math.min(o.width, len);
          const half = width / 2;
          const offset = Math.max(
            half,
            Math.min(len - half, o.offset + width),
          );
          bucket[id] = { ...o, id, width, offset };
          selItems.push({ type, id });
        }
      }
    };
    pasteOpenings(clip.doors, doors, "door");
    pasteOpenings(clip.windows, windows, "window");

    for (const f of clip.furniture) {
      const id = uid("f");
      furniture[id] = { ...f, id, x: f.x + off, y: f.y + off };
      selItems.push({ type: "furniture", id });
    }
    for (const t of clip.texts) {
      const id = uid("txt");
      texts[id] = { ...t, id, x: t.x + off, y: t.y + off };
      selItems.push({ type: "text", id });
    }

    if (selItems.length === 0) return;
    pasteCountRef.current += 1;
    commit(() => ({ nodes, walls, doors, windows, furniture, texts }));
    if (selItems.length === 1) setSelection(selItems[0] as Selection);
    else setMultiSelection(selItems);
  };

  const pruneOrphans = (d: Doc): Doc => {
    const used = new Set<string>();
    for (const w of Object.values(d.walls)) {
      used.add(w.a);
      used.add(w.b);
    }
    const nodes: Doc["nodes"] = {};
    for (const id of Object.keys(d.nodes)) {
      if (used.has(id)) nodes[id] = d.nodes[id];
    }
    return { ...d, nodes };
  };

  const deleteById: StoreValue["deleteById"] = (type, id) => {
    commit((d) => {
      if (type === "wall") {
        const walls = { ...d.walls };
        delete walls[id];
        const doors = Object.fromEntries(
          Object.entries(d.doors).filter(([, o]) => o.wallId !== id),
        );
        const windows = Object.fromEntries(
          Object.entries(d.windows).filter(([, o]) => o.wallId !== id),
        );
        return pruneOrphans({ ...d, walls, doors, windows });
      }
      if (type === "node") {
        const wallIds = Object.values(d.walls)
          .filter((w) => w.a === id || w.b === id)
          .map((w) => w.id);
        const walls = { ...d.walls };
        for (const wid of wallIds) delete walls[wid];
        const doors = Object.fromEntries(
          Object.entries(d.doors).filter(([, o]) => !wallIds.includes(o.wallId)),
        );
        const windows = Object.fromEntries(
          Object.entries(d.windows).filter(
            ([, o]) => !wallIds.includes(o.wallId),
          ),
        );
        return pruneOrphans({ ...d, walls, doors, windows });
      }
      if (type === "furniture") {
        const furniture = { ...d.furniture };
        delete furniture[id];
        return { ...d, furniture };
      }
      if (type === "text") {
        const texts = { ...d.texts };
        delete texts[id];
        return { ...d, texts };
      }
      const key = type === "door" ? "doors" : "windows";
      const map = { ...d[key] };
      delete map[id];
      return { ...d, [key]: map };
    });
    setSelection(null);
  };

  const deleteMany: StoreValue["deleteMany"] = (items) => {
    if (items.length === 0) return;
    commit((d) => {
      const wallIds = new Set(
        items.filter((i) => i.type === "wall").map((i) => i.id),
      );
      const nodeIds = items.filter((i) => i.type === "node").map((i) => i.id);
      const doorIds = new Set(
        items.filter((i) => i.type === "door").map((i) => i.id),
      );
      const winIds = new Set(
        items.filter((i) => i.type === "window").map((i) => i.id),
      );
      const furnIds = new Set(
        items.filter((i) => i.type === "furniture").map((i) => i.id),
      );
      const textIds = new Set(
        items.filter((i) => i.type === "text").map((i) => i.id),
      );
      // Deleting a node removes every wall attached to it.
      for (const nid of nodeIds) {
        for (const w of Object.values(d.walls)) {
          if (w.a === nid || w.b === nid) wallIds.add(w.id);
        }
      }
      const walls = Object.fromEntries(
        Object.entries(d.walls).filter(([id]) => !wallIds.has(id)),
      );
      const doors = Object.fromEntries(
        Object.entries(d.doors).filter(
          ([id, o]) => !doorIds.has(id) && !wallIds.has(o.wallId),
        ),
      );
      const windows = Object.fromEntries(
        Object.entries(d.windows).filter(
          ([id, o]) => !winIds.has(id) && !wallIds.has(o.wallId),
        ),
      );
      const furniture = Object.fromEntries(
        Object.entries(d.furniture).filter(([id]) => !furnIds.has(id)),
      );
      const texts = Object.fromEntries(
        Object.entries(d.texts).filter(([id]) => !textIds.has(id)),
      );
      return pruneOrphans({ ...d, walls, doors, windows, furniture, texts });
    });
    setSelection(null);
  };

  const setNodePos: StoreValue["setNodePos"] = (id, x, y) => {
    update((d) => {
      const n = d.nodes[id];
      if (!n) return d;
      return { ...d, nodes: { ...d.nodes, [id]: { ...n, x, y } } };
    });
  };

  const setNodePosCommitted: StoreValue["setNodePosCommitted"] = (id, x, y) => {
    commit((d) => {
      const n = d.nodes[id];
      if (!n) return d;
      return { ...d, nodes: { ...d.nodes, [id]: { ...n, x, y } } };
    });
  };

  const setWallThickness: StoreValue["setWallThickness"] = (id, thickness) => {
    commit((d) => {
      const w = d.walls[id];
      if (!w) return d;
      return {
        ...d,
        walls: {
          ...d.walls,
          [id]: { ...w, thickness: Math.max(1, thickness) },
        },
      };
    });
  };

  // Detach endpoint b of wall into its own node if shared and joints unlocked
  const maybeDetach = (
    d: Doc,
    wallId: string,
  ): { doc: Doc; movingId: string } => {
    const w = d.walls[wallId];
    const sharedCount = Object.values(d.walls).filter(
      (x) => x.a === w.b || x.b === w.b,
    ).length;
    if (settings.lockJoints || sharedCount <= 1) {
      return { doc: d, movingId: w.b };
    }
    const newId = uid("n");
    const src = d.nodes[w.b];
    const nodes = { ...d.nodes, [newId]: { ...src, id: newId } };
    const walls = { ...d.walls, [wallId]: { ...w, b: newId } };
    return { doc: { ...d, nodes, walls }, movingId: newId };
  };

  const setWallLength: StoreValue["setWallLength"] = (id, lengthCm) => {
    const d0 = docRef.current;
    const w = d0.walls[id];
    if (!w) return;
    const a = d0.nodes[w.a];
    const b = d0.nodes[w.b];
    if (!a || !b) return;
    const len = dist(a.x, a.y, b.x, b.y);
    const ux = len === 0 ? 1 : (b.x - a.x) / len;
    const uy = len === 0 ? 0 : (b.y - a.y) / len;
    const L = Math.max(1, lengthCm);
    const { doc: d1, movingId } = maybeDetach(d0, id);
    const nx = a.x + ux * L;
    const ny = a.y + uy * L;
    beginChange();
    setDoc({
      ...d1,
      nodes: { ...d1.nodes, [movingId]: { ...d1.nodes[movingId], x: nx, y: ny } },
    });
  };

  const setWallAngle: StoreValue["setWallAngle"] = (id, deg) => {
    const d0 = docRef.current;
    const w = d0.walls[id];
    if (!w) return;
    const a = d0.nodes[w.a];
    const b = d0.nodes[w.b];
    if (!a || !b) return;
    const len = dist(a.x, a.y, b.x, b.y);
    const rad = (deg * Math.PI) / 180;
    const { doc: d1, movingId } = maybeDetach(d0, id);
    const nx = a.x + len * Math.cos(rad);
    const ny = a.y + len * Math.sin(rad);
    beginChange();
    setDoc({
      ...d1,
      nodes: { ...d1.nodes, [movingId]: { ...d1.nodes[movingId], x: nx, y: ny } },
    });
  };

  const applyOpening = (
    d: Doc,
    kind: "door" | "window",
    id: string,
    patch: { width?: number; offset?: number; flipX?: boolean; flipY?: boolean },
  ): Doc => {
    const key = kind === "door" ? "doors" : "windows";
    const op = d[key][id];
    if (!op) return d;
    const g = wallGeom(d, op.wallId);
    let width = patch.width ?? op.width;
    let offset = patch.offset ?? op.offset;
    if (g) {
      width = Math.min(Math.max(20, width), g.len - 2);
      offset = Math.max(width / 2, Math.min(g.len - width / 2, offset));
    }
    const flipX = patch.flipX ?? op.flipX;
    const flipY = patch.flipY ?? op.flipY;
    return {
      ...d,
      [key]: { ...d[key], [id]: { ...op, width, offset, flipX, flipY } },
    };
  };

  const setOpening: StoreValue["setOpening"] = (kind, id, patch) => {
    commit((d) => applyOpening(d, kind, id, patch));
  };

  const setOpeningLive: StoreValue["setOpeningLive"] = (kind, id, patch) => {
    update((d) => applyOpening(d, kind, id, patch));
  };

  const replaceDoc: StoreValue["replaceDoc"] = (d) => {
    commit(() => d);
    setSelection(null);
  };

  const clearAll: StoreValue["clearAll"] = () => {
    commit(() => ({
      nodes: {},
      walls: {},
      doors: {},
      windows: {},
      furniture: {},
      texts: {},
    }));
    setSelection(null);
  };

  const value: StoreValue = {
    doc,
    rooms,
    settings,
    view,
    tool,
    selection,
    multiSelection,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    setTool,
    setSelection,
    setMultiSelection,
    setSettings,
    setView,
    canvasSize,
    setCanvasSize,
    beginChange,
    update,
    undo,
    redo,
    addWall,
    addOpening,
    addFurnitureAtViewCenter,
    addText,
    setFurniture,
    setFurnitureLive,
    setText,
    setTextLive,
    setAppearance,
    setAppearanceLive,
    reorderFurniture,
    copySelection,
    pasteClipboard,
    deleteById,
    deleteMany,
    setNodePos,
    setNodePosCommitted,
    setWallThickness,
    setWallLength,
    setWallAngle,
    setOpening,
    setOpeningLive,
    replaceDoc,
    clearAll,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
