import jsPDF from "jspdf";
import type { Doc, ObjectStyle, Settings } from "../types";
import { emptyDoc } from "../types";
import { detectRooms } from "./rooms";
import {
  wallSegments,
  doorSymbol,
  windowSymbol,
  dimensionLabels,
  joints,
  docBBox,
  wallGeom,
} from "./render";
import { formatLen, formatArea } from "./units";
import { dist } from "./geometry";
import { furnitureSymbol, primToSvgString } from "./furniture";
import {
  DEFAULT_FURNITURE_FILL,
  DEFAULT_STROKE,
  effectFilter,
  gradientDef,
  safeColor,
} from "./appearance";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function effectAttr(style: ObjectStyle, color: string): string {
  const filter = effectFilter(style.effect, color);
  return filter ? ` style="filter:${filter}"` : "";
}

function styleFields(style: ObjectStyle) {
  return {
    ...(style.color != null ? { color: style.color } : {}),
    ...(style.gradientColor != null
      ? { gradientColor: style.gradientColor }
      : {}),
    ...(style.fillColor != null ? { fillColor: style.fillColor } : {}),
    ...(style.effect != null ? { effect: style.effect } : {}),
  };
}

export function buildExportSvg(doc: Doc, settings: Settings): string {
  const bbox = docBBox(doc) ?? { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  const pad = 60;
  const minX = bbox.minX - pad;
  const minY = bbox.minY - pad;
  const w = bbox.maxX - bbox.minX + pad * 2;
  const h = bbox.maxY - bbox.minY + pad * 2;
  const rooms = detectRooms(doc);
  const parts: string[] = [];

  parts.push(
    `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#ffffff"/>`,
  );

  // rooms
  for (const r of rooms) {
    const pts = r.points.map((p) => `${p.x},${p.y}`).join(" ");
    parts.push(`<polygon points="${pts}" fill="#f4f4f4"/>`);
    parts.push(
      `<text x="${r.centroid.x}" y="${r.centroid.y}" font-family="Inter, sans-serif" font-size="16" fill="#111" text-anchor="middle">${esc(
        formatArea(r.area, settings.unit),
      )}</text>`,
    );
  }

  // walls
  for (const [index, id] of Object.keys(doc.walls).entries()) {
    const wall = doc.walls[id];
    const color = safeColor(wall.color, DEFAULT_STROKE);
    const gradientId = `export-wall-gradient-${index}`;
    const stroke = wall.gradientColor
      ? `url(#${gradientId})`
      : color;
    parts.push(
      `<g${effectAttr(wall, color)}>${wall.gradientColor ? `<defs>${gradientDef(
        gradientId,
        color,
        safeColor(wall.gradientColor),
      )}</defs>` : ""}`,
    );
    for (const s of wallSegments(doc, id)) {
      parts.push(
        `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${stroke}" stroke-width="${wall.thickness}" stroke-linecap="butt"/>`,
      );
    }
    parts.push("</g>");
  }

  // joints
  for (const j of joints(doc)) {
    parts.push(
      `<rect x="${j.x - j.size / 2}" y="${j.y - j.size / 2}" width="${j.size}" height="${j.size}" fill="#111"/>`,
    );
  }

  // doors
  for (const [index, op] of Object.values(doc.doors).entries()) {
    const d = doorSymbol(doc, op);
    if (!d) continue;
    const color = safeColor(op.color, DEFAULT_STROKE);
    const gradientId = `export-door-gradient-${index}`;
    const stroke = op.gradientColor ? `url(#${gradientId})` : color;
    parts.push(`<g${effectAttr(op, color)}>${op.gradientColor ? `<defs>${gradientDef(
      gradientId,
      color,
      safeColor(op.gradientColor),
    )}</defs>` : ""}`);
    parts.push(jambCap(d.j1x, d.j1y, op.wallId, doc, stroke));
    parts.push(jambCap(d.j2x, d.j2y, op.wallId, doc, stroke));
    parts.push(
      `<line x1="${d.hingeX}" y1="${d.hingeY}" x2="${d.lx}" y2="${d.ly}" stroke="${stroke}" stroke-width="2"/>`,
    );
    parts.push(
      `<path d="M ${d.arcStartX} ${d.arcStartY} A ${d.r} ${d.r} 0 0 ${d.sweep} ${d.arcEndX} ${d.arcEndY}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`,
    );
    parts.push("</g>");
  }

  // windows
  for (const [index, op] of Object.values(doc.windows).entries()) {
    const wn = windowSymbol(doc, op);
    if (!wn) continue;
    const color = safeColor(op.color, DEFAULT_STROKE);
    const gradientId = `export-window-gradient-${index}`;
    const stroke = op.gradientColor ? `url(#${gradientId})` : color;
    parts.push(`<g${effectAttr(op, color)}>${op.gradientColor ? `<defs>${gradientDef(
      gradientId,
      color,
      safeColor(op.gradientColor),
    )}</defs>` : ""}`);
    parts.push(jambCap(wn.j1x, wn.j1y, op.wallId, doc, stroke));
    parts.push(jambCap(wn.j2x, wn.j2y, op.wallId, doc, stroke));
    const o1 = wn.thickness / 2;
    parts.push(
        `<line x1="${wn.j1x + wn.nx * o1}" y1="${wn.j1y + wn.ny * o1}" x2="${wn.j2x + wn.nx * o1}" y2="${wn.j2y + wn.ny * o1}" stroke="${stroke}" stroke-width="2"/>`,
    );
    parts.push(
        `<line x1="${wn.j1x - wn.nx * o1}" y1="${wn.j1y - wn.ny * o1}" x2="${wn.j2x - wn.nx * o1}" y2="${wn.j2y - wn.ny * o1}" stroke="${stroke}" stroke-width="2"/>`,
    );
    parts.push("</g>");
  }

  // furniture
  for (const [index, f] of Object.values(doc.furniture).entries()) {
    const prims = furnitureSymbol(f.kind, f.w, f.h);
    const color = safeColor(f.color, DEFAULT_STROKE);
    const strokeGradientId = `export-furniture-stroke-${index}`;
    const fillGradientId = `export-furniture-fill-${index}`;
    const stroke = f.gradientColor ? `url(#${strokeGradientId})` : color;
    const fill = f.gradientColor
      ? `url(#${fillGradientId})`
      : f.fillColor
        ? safeColor(f.fillColor, DEFAULT_FURNITURE_FILL)
        : undefined;
    const inner = prims
      .map((p) => primToSvgString(p, stroke, 2, fill))
      .join("");
    const label = f.label
      ? `<text x="0" y="0" font-family="Inter, sans-serif" font-size="${Math.max(
          8,
          Math.min(f.w, f.h) * 0.18,
        )}" fill="${color}" text-anchor="middle" dominant-baseline="central">${esc(
          f.label,
        )}</text>`
      : "";
    parts.push(
      `<g transform="translate(${f.x} ${f.y}) rotate(${f.rotation})"${effectAttr(f, color)}>${f.gradientColor ? `<defs>${gradientDef(
        strokeGradientId,
        color,
        safeColor(f.gradientColor),
      )}${gradientDef(
        fillGradientId,
        safeColor(f.fillColor, DEFAULT_FURNITURE_FILL),
        safeColor(f.gradientColor),
      )}</defs>` : ""}${inner}${label}</g>`,
    );
  }

  for (const [index, item] of Object.values(doc.texts).entries()) {
    const color = safeColor(item.color, DEFAULT_STROKE);
    const gradientId = `export-text-gradient-${index}`;
    const fill = item.gradientColor ? `url(#${gradientId})` : color;
    parts.push(
      `<g transform="translate(${item.x} ${item.y}) rotate(${item.rotation})"${effectAttr(item, color)}>${item.gradientColor ? `<defs>${gradientDef(
        gradientId,
        color,
        safeColor(item.gradientColor),
      )}</defs>` : ""}<text x="0" y="0" font-family="Inter, sans-serif" font-size="${item.fontSize}" fill="${fill}" text-anchor="middle" dominant-baseline="central">${esc(
        item.text,
      )}</text></g>`,
    );
  }

  // dimension labels
  if (settings.labelsVisible) {
    for (const d of dimensionLabels(doc)) {
      parts.push(
        `<text x="${d.x}" y="${d.y}" font-family="Inter, sans-serif" font-size="13" fill="#111" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="3">${esc(
          formatLen(d.len, settings.unit),
        )}</text>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}">${parts.join(
    "",
  )}</svg>`;
}

function jambCap(
  x: number,
  y: number,
  wallId: string,
  doc: Doc,
  color = DEFAULT_STROKE,
): string {
  const g = wallGeom(doc, wallId);
  if (!g) return "";
  const o = g.thickness / 2;
  return `<line x1="${x + g.nx * o}" y1="${y + g.ny * o}" x2="${x - g.nx * o}" y2="${y - g.ny * o}" stroke="${color}" stroke-width="2"/>`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportJSON(doc: Doc): void {
  const out = {
    walls: Object.values(doc.walls).map((w) => {
      const a = doc.nodes[w.a];
      const b = doc.nodes[w.b];
      return {
        id: w.id,
        x1: a?.x ?? 0,
        y1: a?.y ?? 0,
        x2: b?.x ?? 0,
        y2: b?.y ?? 0,
        thickness: w.thickness,
        ...styleFields(w),
      };
    }),
    doors: Object.values(doc.doors).map((o) => ({
      id: o.id,
      wallId: o.wallId,
      offset: o.offset,
      width: o.width,
      flipX: o.flipX ?? false,
      flipY: o.flipY ?? false,
      ...styleFields(o),
    })),
    windows: Object.values(doc.windows).map((o) => ({
      id: o.id,
      wallId: o.wallId,
      offset: o.offset,
      width: o.width,
      ...styleFields(o),
    })),
    furniture: Object.values(doc.furniture).map((f) => ({
      id: f.id,
      kind: f.kind,
      x: f.x,
      y: f.y,
      rotation: f.rotation,
      w: f.w,
      h: f.h,
      ...(f.label != null ? { label: f.label } : {}),
      ...styleFields(f),
    })),
    texts: Object.values(doc.texts).map((item) => ({
      ...item,
      ...styleFields(item),
    })),
    rooms: detectRooms(doc).map((r) => ({
      id: r.id,
      points: r.points,
      area: r.area,
    })),
  };
  downloadBlob(
    new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }),
    "floorplan.json",
  );
}

interface FlatWall {
  id?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness?: number;
}

let importCounter = 0;
function nid(p: string): string {
  return `${p}_imp_${Date.now().toString(36)}_${(importCounter++).toString(36)}`;
}

export function importJSON(text: string): Doc {
  const data = JSON.parse(text) as {
    walls?: (FlatWall & ObjectStyle)[];
    doors?: {
      id?: string;
      wallId: string;
      offset: number;
      width: number;
      flipX?: boolean;
      flipY?: boolean;
      color?: string;
      gradientColor?: string;
      fillColor?: string;
      effect?: ObjectStyle["effect"];
    }[];
    windows?: {
      id?: string;
      wallId: string;
      offset: number;
      width: number;
      color?: string;
      gradientColor?: string;
      fillColor?: string;
      effect?: ObjectStyle["effect"];
    }[];
    furniture?: {
      id?: string;
      kind: string;
      x: number;
      y: number;
      rotation?: number;
      w: number;
      h: number;
      label?: string;
      color?: string;
      gradientColor?: string;
      fillColor?: string;
      effect?: ObjectStyle["effect"];
    }[];
    texts?: Omit<import("../types").TextItem, "id">[] &
      { id?: string }[];
  };
  const doc = emptyDoc();
  const nodeKey = new Map<string, string>();
  const getNode = (x: number, y: number): string => {
    const key = `${Math.round(x * 10)}:${Math.round(y * 10)}`;
    const existing = nodeKey.get(key);
    if (existing) return existing;
    const id = nid("n");
    doc.nodes[id] = { id, x, y };
    nodeKey.set(key, id);
    return id;
  };
  for (const w of data.walls ?? []) {
    if (dist(w.x1, w.y1, w.x2, w.y2) < 1e-6) continue;
    const a = getNode(w.x1, w.y1);
    const b = getNode(w.x2, w.y2);
    const id = w.id ?? nid("w");
    doc.walls[id] = {
      ...styleFields(w),
      id,
      a,
      b,
      thickness: w.thickness ?? 10,
    };
  }
  for (const o of data.doors ?? []) {
    if (!doc.walls[o.wallId]) continue;
    const id = o.id ?? nid("d");
    doc.doors[id] = {
      id,
      wallId: o.wallId,
      offset: o.offset,
      width: o.width,
      flipX: o.flipX ?? false,
      flipY: o.flipY ?? false,
      ...styleFields(o),
    };
  }
  for (const o of data.windows ?? []) {
    if (!doc.walls[o.wallId]) continue;
    const id = o.id ?? nid("win");
    doc.windows[id] = {
      id,
      wallId: o.wallId,
      offset: o.offset,
      width: o.width,
      ...styleFields(o),
    };
  }
  for (const f of data.furniture ?? []) {
    const id = f.id ?? nid("f");
    doc.furniture[id] = {
      id,
      kind: f.kind,
      x: f.x,
      y: f.y,
      rotation: f.rotation ?? 0,
      w: f.w,
      h: f.h,
      ...(f.label != null ? { label: f.label } : {}),
      ...styleFields(f),
    };
  }
  for (const item of data.texts ?? []) {
    const id = item.id ?? nid("txt");
    doc.texts[id] = {
      ...item,
      id,
      rotation: item.rotation ?? 0,
      fontSize: item.fontSize ?? 20,
    };
  }
  return doc;
}

async function svgToCanvas(
  svg: string,
  scale: number,
): Promise<HTMLCanvasElement> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to render SVG"));
      img.src = url;
    });
    const w = img.width || 800;
    const h = img.height || 600;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportPNG(doc: Doc, settings: Settings): Promise<void> {
  const svg = buildExportSvg(doc, settings);
  const canvas = await svgToCanvas(svg, 3);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, "floorplan.png");
      resolve();
    }, "image/png");
  });
}

async function buildPdf(
  doc: Doc,
  settings: Settings,
  opts?: { scale?: number; jpeg?: boolean },
): Promise<jsPDF> {
  const svg = buildExportSvg(doc, settings);
  const canvas = await svgToCanvas(svg, opts?.scale ?? 3);
  const imgW = canvas.width;
  const imgH = canvas.height;
  const orientation = imgW >= imgH ? "landscape" : "portrait";
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - 24;
  const ratio = Math.min(availW / imgW, availH / imgH);
  const drawW = imgW * ratio;
  const drawH = imgH * ratio;
  const x = (pageW - drawW) / 2;
  const y = margin + 24;
  pdf.setFontSize(12);
  pdf.text("Plano", margin, margin);
  if (opts?.jpeg) {
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.82), "JPEG", x, y, drawW, drawH);
  } else {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, drawW, drawH);
  }
  return pdf;
}

export async function exportPDF(doc: Doc, settings: Settings): Promise<void> {
  const pdf = await buildPdf(doc, settings);
  pdf.save("floorplan.pdf");
}

// Base64-encoded PDF (no data-URI prefix).
export async function buildPdfBase64(
  doc: Doc,
  settings: Settings,
): Promise<string> {
  // Compressed (JPEG, scale 2) so the attachment stays well under upload limits.
  const pdf = await buildPdf(doc, settings, { scale: 2, jpeg: true });
  const dataUri = pdf.output("datauristring");
  return dataUri.slice(dataUri.indexOf(",") + 1);
}
