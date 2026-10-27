import type { ObjectEffect } from "../types";

export const DEFAULT_STROKE = "#111111";
export const DEFAULT_FURNITURE_FILL = "#ffffff";

export function safeColor(value: string | undefined, fallback = DEFAULT_STROKE) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function effectFilter(
  effect: ObjectEffect | undefined,
  color?: string,
): string | undefined {
  if (effect === "shadow") return "drop-shadow(0 2px 2px rgba(0,0,0,.28))";
  if (effect === "glow") {
    return `drop-shadow(0 0 3px ${safeColor(color)})`;
  }
  return undefined;
}

export function effectStyle(
  effect: ObjectEffect | undefined,
  color?: string,
): { filter?: string } {
  const filter = effectFilter(effect, color);
  return filter ? { filter } : {};
}

export function gradientDef(id: string, start: string, end: string): string {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${safeColor(start)}"/><stop offset="100%" stop-color="${safeColor(end)}"/></linearGradient>`;
}
