import type { Unit } from "../types";

const CM_PER_INCH = 2.54;
const CM_PER_FOOT = 30.48;

function trim(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

// Convert a world value (cm) into the active display unit.
export function toDisplay(cm: number, unit: Unit): number {
  if (unit === "m") return cm / 100;
  if (unit === "in") return cm / CM_PER_INCH;
  return cm;
}

// Sensible numeric input step for the active unit.
export function displayStep(unit: Unit): number {
  if (unit === "m") return 0.01;
  if (unit === "in") return 0.1;
  return 1;
}

// Major grid spacing (cm): 1 ft for imperial, 1 m for metric.
export function gridMajorStep(unit: Unit): number {
  return unit === "in" ? CM_PER_FOOT : 100;
}

// Minor grid + snap spacing (cm): 1 in for imperial, 1 dm for metric.
export function gridMinorStep(unit: Unit): number {
  return unit === "in" ? CM_PER_INCH : 10;
}

export function formatLen(cm: number, unit: Unit, withUnit = true): string {
  if (unit === "m") {
    return `${trim(cm / 100)}${withUnit ? " m" : ""}`;
  }
  if (unit === "in") {
    return `${Math.round((cm / CM_PER_INCH) * 10) / 10}${withUnit ? " in" : ""}`;
  }
  return `${Math.round(cm * 10) / 10}${withUnit ? " cm" : ""}`;
}

export function formatArea(cm2: number, unit: Unit = "m"): string {
  if (unit === "in") {
    const ft2 = cm2 / (CM_PER_FOOT * CM_PER_FOOT);
    return `${(Math.round(ft2 * 100) / 100).toFixed(2)} ft²`;
  }
  const m2 = cm2 / 10000;
  return `${(Math.round(m2 * 100) / 100).toFixed(2)} m²`;
}

export function parseLen(str: string, unit: Unit): number | null {
  const v = parseFloat(str);
  if (Number.isNaN(v)) return null;
  if (unit === "m") return v * 100;
  if (unit === "in") return v * CM_PER_INCH;
  return v;
}
