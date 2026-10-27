import type { Tool } from "../types";

/** Single source of truth for tool names and their keyboard shortcut. */
export const TOOL_META: Record<Tool, { label: string; key: string }> = {
  select: { label: "Seleccionar", key: "V" },
  pan: { label: "Mover vista (Pan)", key: "H" },
  wall: { label: "Pared", key: "W" },
  door: { label: "Puerta", key: "D" },
  window: { label: "Ventana", key: "N" },
  text: { label: "Texto", key: "T" },
  measure: { label: "Medir longitud", key: "M" },
  area: { label: "Medir área", key: "A" },
  delete: { label: "Eliminar", key: "X" },
};

export function toolForKey(key: string): Tool | null {
  const k = key.toUpperCase();
  for (const [tool, meta] of Object.entries(TOOL_META)) {
    if (meta.key === k) return tool as Tool;
  }
  return null;
}

interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

const mod = /Mac|iPhone|iPad/.test(
  typeof navigator !== "undefined" ? navigator.platform : "",
)
  ? "⌘"
  : "Ctrl";

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Herramientas",
    items: Object.values(TOOL_META).map((m) => ({
      keys: [m.key],
      label: m.label,
    })),
  },
  {
    title: "Edición",
    items: [
      { keys: [mod, "Z"], label: "Deshacer" },
      { keys: [mod, "Y"], label: "Rehacer" },
      { keys: [mod, "C"], label: "Copiar" },
      { keys: [mod, "V"], label: "Pegar" },
      { keys: ["Supr"], label: "Eliminar selección" },
      { keys: ["Esc"], label: "Cancelar / deseleccionar" },
    ],
  },
  {
    title: "Vista",
    items: [
      { keys: ["+"], label: "Acercar" },
      { keys: ["−"], label: "Alejar" },
      { keys: ["0"], label: "Zoom 100 %" },
      { keys: ["F"], label: "Ajustar a la vista" },
      { keys: ["Espacio", "arrastrar"], label: "Mover la vista" },
      { keys: ["Rueda"], label: "Desplazar (con " + mod + ": zoom)" },
    ],
  },
  {
    title: "Medir área",
    items: [
      { keys: ["Clic"], label: "Añadir vértice" },
      { keys: ["Enter"], label: "Cerrar polígono" },
      { keys: ["⌫"], label: "Quitar último vértice" },
    ],
  },
  {
    title: "Mobiliario",
    items: [
      { keys: ["Alt", "arrastrar"], label: "Mover sin guías de alineación" },
      { keys: ["Arrastrar"], label: "Mover; se alinea con otros objetos" },
    ],
  },
  {
    title: "Ayuda",
    items: [{ keys: ["?"], label: "Mostrar esta lista" }],
  },
];
