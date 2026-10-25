import type { Doc, Settings } from "../types";
import { emptyDoc, defaultSettings } from "../types";
import { parseStored } from "./schema";

const KEY = "floorplan:v1";
const BACKUP_KEY = "floorplan:v1:backup";

export interface LoadResult {
  doc: Doc;
  settings: Settings;
  /** Set when stored data could not be used (corrupt / storage blocked). */
  warning?: string;
}

export type SaveResult =
  | { ok: true }
  | { ok: false; reason: "quota" | "unavailable" | "unknown"; message: string };

function fresh(warning?: string): LoadResult {
  return { doc: emptyDoc(), settings: defaultSettings(), warning };
}

export function loadState(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return fresh(
      "El navegador bloquea el almacenamiento local: los cambios no se guardarán entre sesiones. Exporta tu plano a JSON para conservarlo.",
    );
  }
  if (!raw) return fresh();

  let reason = "";
  try {
    const parsed = parseStored(JSON.parse(raw));
    if (parsed.ok) return { doc: parsed.doc, settings: parsed.settings };
    reason = parsed.reason;
  } catch {
    reason = "JSON ilegible";
  }

  // Keep the unreadable data so it is never silently destroyed by autosave.
  let kept = false;
  try {
    localStorage.setItem(BACKUP_KEY, raw);
    kept = true;
  } catch {
    // ignore: nothing else we can do
  }
  return fresh(
    `Los datos guardados estaban dañados (${reason}) y no se pudieron cargar.` +
      (kept ? ` Se conservó una copia en el navegador (${BACKUP_KEY}).` : ""),
  );
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014)
  );
}

const EXPORT_HINT = "Exporta tu plano a JSON para no perder el trabajo.";

export function saveState(doc: Doc, settings: Settings): SaveResult {
  try {
    localStorage.setItem(KEY, JSON.stringify({ doc, settings }));
    return { ok: true };
  } catch (e) {
    if (isQuotaError(e)) {
      return {
        ok: false,
        reason: "quota",
        message: `No se pudo guardar: el almacenamiento del navegador está lleno. ${EXPORT_HINT}`,
      };
    }
    if (e instanceof DOMException && e.name === "SecurityError") {
      return {
        ok: false,
        reason: "unavailable",
        message: `No se pudo guardar: el navegador bloquea el almacenamiento local (¿modo privado?). ${EXPORT_HINT}`,
      };
    }
    return {
      ok: false,
      reason: "unknown",
      message: `No se pudo guardar el plano. ${EXPORT_HINT}`,
    };
  }
}
