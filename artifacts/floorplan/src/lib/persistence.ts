import type { Doc, Settings } from "../types";
import { emptyDoc, defaultSettings } from "../types";

const KEY = "floorplan:v1";

interface Saved {
  doc: Doc;
  settings: Settings;
}

export function loadState(): Saved {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { doc: emptyDoc(), settings: defaultSettings() };
    const parsed = JSON.parse(raw) as Partial<Saved>;
    const settings = { ...defaultSettings(), ...(parsed.settings ?? {}) };
    // The unit toggle only offers cm/in now; coerce any legacy "m" state.
    if (settings.unit === "m") settings.unit = "cm";
    return {
      doc: normalizeDoc(parsed.doc),
      settings,
    };
  } catch {
    return { doc: emptyDoc(), settings: defaultSettings() };
  }
}

export function saveState(doc: Doc, settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ doc, settings }));
  } catch {
    // ignore quota / serialization errors
  }
}

function normalizeDoc(doc: Partial<Doc> | undefined): Doc {
  if (!doc) return emptyDoc();
  return {
    nodes: doc.nodes ?? {},
    walls: doc.walls ?? {},
    doors: doc.doors ?? {},
    windows: doc.windows ?? {},
    furniture: doc.furniture ?? {},
    texts: doc.texts ?? {},
  };
}
