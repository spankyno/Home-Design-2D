export type Unit = "m" | "cm" | "in";

export type Tool =
  | "select"
  | "pan"
  | "wall"
  | "door"
  | "window"
  | "text"
  | "measure"
  | "area"
  | "delete";

export type ObjectEffect = "none" | "shadow" | "glow";

export interface ObjectStyle {
  color?: string;
  gradientColor?: string;
  fillColor?: string;
  effect?: ObjectEffect;
}

export interface Node {
  id: string;
  x: number; // cm
  y: number; // cm
}

export interface Wall extends ObjectStyle {
  id: string;
  a: string; // node id
  b: string; // node id
  thickness: number; // cm
}

export interface Opening extends ObjectStyle {
  id: string;
  wallId: string;
  offset: number; // cm from node a along wall to opening center
  width: number; // cm
  flipX?: boolean; // door: hinge at far jamb instead of near jamb
  flipY?: boolean; // door: swing to the opposite side of the wall
}

export interface Furniture extends ObjectStyle {
  id: string;
  kind: string; // FurnitureKind from lib/furniture
  x: number; // cm, center
  y: number; // cm, center
  rotation: number; // degrees, clockwise
  w: number; // cm, footprint width (local x)
  h: number; // cm, footprint depth (local y)
  label?: string; // free text shown inside the footprint (custom items)
}

export interface TextItem extends ObjectStyle {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
}

export interface Doc {
  nodes: Record<string, Node>;
  walls: Record<string, Wall>;
  doors: Record<string, Opening>;
  windows: Record<string, Opening>;
  furniture: Record<string, Furniture>;
  texts: Record<string, TextItem>;
}

export interface Settings {
  unit: Unit;
  gridVisible: boolean;
  labelsVisible: boolean;
  angleSnap: boolean;
  gridSnap: boolean;
  lockJoints: boolean;
  smartGuides: boolean;
}

export interface View {
  z: number;
  tx: number;
  ty: number;
}

export type Selection =
  | { type: "wall"; id: string }
  | { type: "node"; id: string }
  | { type: "door"; id: string }
  | { type: "window"; id: string }
  | { type: "room"; id: string }
  | { type: "furniture"; id: string }
  | { type: "text"; id: string }
  | null;

export type SelItem = {
  type: "wall" | "node" | "door" | "window" | "furniture" | "text";
  id: string;
};

export interface RoomInfo {
  id: string;
  nodeIds: string[];
  points: { x: number; y: number }[];
  area: number; // cm^2
  centroid: { x: number; y: number };
}

export interface ResolvedPoint {
  x: number;
  y: number;
  nodeId?: string;
  snap: "node" | "angle" | "grid" | "none";
}

export function emptyDoc(): Doc {
  return {
    nodes: {},
    walls: {},
    doors: {},
    windows: {},
    furniture: {},
    texts: {},
  };
}

export function defaultSettings(): Settings {
  return {
    unit: "cm",
    gridVisible: true,
    labelsVisible: true,
    angleSnap: true,
    gridSnap: false,
    lockJoints: true,
    smartGuides: true,
  };
}
