import { z } from "zod";
import type { Doc, Settings } from "../types";
import { emptyDoc, defaultSettings } from "../types";

/**
 * Runtime validation (Zod) for every piece of data that enters the editor from
 * outside: imported JSON files and the state restored from localStorage.
 * Nothing that fails validation ever reaches the store.
 */

const MAX_COORD = 1_000_000; // cm (10 km): rejects absurd / overflowing values
const MAX_ITEMS = 5_000;
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const RESERVED_IDS = new Set(["__proto__", "constructor", "prototype"]);

const num = z.number().finite().min(-MAX_COORD).max(MAX_COORD);
const positive = (max: number) => z.number().finite().positive().max(max);
const idSchema = z
  .string()
  .min(1)
  .max(120)
  .refine((s) => !RESERVED_IDS.has(s), { message: "identificador reservado" });

// Appearance fields are cosmetic: an invalid value is dropped, not fatal.
const hex = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i)
  .optional()
  .catch(undefined);
const effect = z.enum(["none", "shadow", "glow"]).optional().catch(undefined);
const style = {
  color: hex,
  gradientColor: hex,
  fillColor: hex,
  effect,
};
const optBool = z.boolean().optional().catch(undefined);

// ---------------------------------------------------------------- import
const importWall = z.object({
  id: idSchema.optional(),
  x1: num,
  y1: num,
  x2: num,
  y2: num,
  thickness: positive(1000).optional(),
  ...style,
});
const importDoor = z.object({
  id: idSchema.optional(),
  wallId: idSchema,
  offset: num,
  width: positive(1000),
  flipX: optBool,
  flipY: optBool,
  ...style,
});
const importWindow = z.object({
  id: idSchema.optional(),
  wallId: idSchema,
  offset: num,
  width: positive(1000),
  ...style,
});
const importFurniture = z.object({
  id: idSchema.optional(),
  kind: z.string().min(1).max(60),
  x: num,
  y: num,
  rotation: num.optional(),
  w: positive(10_000),
  h: positive(10_000),
  label: z.string().max(200).optional().catch(undefined),
  ...style,
});
const importText = z.object({
  id: idSchema.optional(),
  text: z.string().max(500),
  x: num,
  y: num,
  rotation: num.optional(),
  fontSize: positive(1000).optional(),
  ...style,
});

const list = <T extends z.ZodTypeAny>(item: T) =>
  z.array(item).max(MAX_ITEMS).optional();

export const importSchema = z
  .object({
    walls: list(importWall),
    doors: list(importDoor),
    windows: list(importWindow),
    furniture: list(importFurniture),
    texts: list(importText),
  })
  .refine(
    (d) =>
      d.walls !== undefined ||
      d.doors !== undefined ||
      d.windows !== undefined ||
      d.furniture !== undefined ||
      d.texts !== undefined,
    { message: "el archivo no parece un plano (faltan paredes, mobiliario…)" },
  );

export type ImportData = z.infer<typeof importSchema>;

// ------------------------------------------------------- Spanish messages
const TYPE_ES: Record<string, string> = {
  string: "texto",
  number: "número",
  boolean: "verdadero/falso",
  array: "lista",
  object: "objeto",
};

const esErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case "invalid_type":
      return {
        message:
          issue.received === "undefined"
            ? "es obligatorio"
            : `debe ser ${TYPE_ES[issue.expected] ?? issue.expected}`,
      };
    case "too_small":
      if (issue.type === "string") return { message: "está vacío" };
      if (issue.type === "array") return { message: "faltan elementos" };
      return {
        message: issue.inclusive
          ? `debe ser ≥ ${String(issue.minimum)}`
          : `debe ser mayor que ${String(issue.minimum)}`,
      };
    case "too_big":
      if (issue.type === "string") {
        return { message: `es demasiado largo (máx. ${String(issue.maximum)})` };
      }
      if (issue.type === "array") {
        return { message: `tiene demasiados elementos (máx. ${String(issue.maximum)})` };
      }
      return { message: `debe ser ≤ ${String(issue.maximum)}` };
    case "not_finite":
      return { message: "debe ser un número finito" };
    case "invalid_string":
      return { message: "tiene un formato no válido" };
    case "invalid_enum_value":
      return { message: "tiene un valor no permitido" };
    case "custom":
      return { message: issue.message ?? ctx.defaultError };
    default:
      return { message: ctx.defaultError };
  }
};

function formatPath(path: (string | number)[]): string {
  return path.reduce<string>(
    (acc, seg) =>
      typeof seg === "number" ? `${acc}[${seg + 1}]` : acc ? `${acc}.${seg}` : seg,
    "",
  );
}

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = "ImportError";
  }
}

function summarize(error: z.ZodError, max = 4): string[] {
  const lines = error.issues.slice(0, max).map((i) => {
    const where = formatPath(i.path);
    return where ? `${where}: ${i.message}` : i.message;
  });
  if (error.issues.length > max) {
    lines.push(`…y ${error.issues.length - max} problema(s) más`);
  }
  return lines;
}

/** Parse + validate an imported file. Throws ImportError with a readable report. */
export function parseImport(text: string): ImportData {
  if (text.length > MAX_IMPORT_BYTES) {
    throw new ImportError("El archivo es demasiado grande (máx. 10 MB).");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError("El archivo no es un JSON válido.");
  }
  const result = importSchema.safeParse(raw, { errorMap: esErrorMap });
  if (!result.success) {
    throw new ImportError(
      "El archivo no tiene el formato de un plano válido.",
      summarize(result.error),
    );
  }
  return result.data;
}

// ------------------------------------------------------- stored (internal)
const storedNode = z.object({ id: idSchema, x: num, y: num });
const storedWall = z.object({
  id: idSchema,
  a: idSchema,
  b: idSchema,
  thickness: positive(1000),
  ...style,
});
const storedOpening = z.object({
  id: idSchema,
  wallId: idSchema,
  offset: num,
  width: positive(1000),
  flipX: optBool,
  flipY: optBool,
  ...style,
});
const storedFurniture = z.object({
  id: idSchema,
  kind: z.string().min(1).max(60),
  x: num,
  y: num,
  rotation: num.catch(0),
  w: positive(10_000),
  h: positive(10_000),
  label: z.string().max(200).optional().catch(undefined),
  ...style,
});
const storedText = z.object({
  id: idSchema,
  text: z.string().max(500),
  x: num,
  y: num,
  rotation: num.catch(0),
  fontSize: positive(1000),
  ...style,
});

const record = <T extends z.ZodTypeAny>(item: T) =>
  z.record(idSchema, item).default({});

const storedDocSchema = z.object({
  nodes: record(storedNode),
  walls: record(storedWall),
  doors: record(storedOpening),
  windows: record(storedOpening),
  furniture: record(storedFurniture),
  texts: record(storedText),
});

const d = defaultSettings();
const storedSettingsSchema = z.object({
  unit: z.enum(["m", "cm", "in"]).catch(d.unit),
  gridVisible: z.boolean().catch(d.gridVisible),
  labelsVisible: z.boolean().catch(d.labelsVisible),
  angleSnap: z.boolean().catch(d.angleSnap),
  gridSnap: z.boolean().catch(d.gridSnap),
  lockJoints: z.boolean().catch(d.lockJoints),
  smartGuides: z.boolean().catch(d.smartGuides),
});

/** Drop entities whose references are broken (walls without nodes, etc.). */
function repairDoc(doc: Doc): Doc {
  const out = emptyDoc();
  out.nodes = doc.nodes;
  out.furniture = doc.furniture;
  out.texts = doc.texts;
  for (const [id, w] of Object.entries(doc.walls)) {
    if (doc.nodes[w.a] && doc.nodes[w.b] && w.a !== w.b) out.walls[id] = w;
  }
  for (const [id, o] of Object.entries(doc.doors)) {
    if (out.walls[o.wallId]) out.doors[id] = o;
  }
  for (const [id, o] of Object.entries(doc.windows)) {
    if (out.walls[o.wallId]) out.windows[id] = o;
  }
  return out;
}

export type StoredParse =
  | { ok: true; doc: Doc; settings: Settings }
  | { ok: false; reason: string };

/** Validate the object restored from localStorage. */
export function parseStored(raw: unknown): StoredParse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "estructura inesperada" };
  }
  const obj = raw as { doc?: unknown; settings?: unknown };
  const docResult = storedDocSchema.safeParse(obj.doc ?? {}, {
    errorMap: esErrorMap,
  });
  if (!docResult.success) {
    return { ok: false, reason: summarize(docResult.error, 1)[0] ?? "datos no válidos" };
  }
  const settings = storedSettingsSchema.parse(
    typeof obj.settings === "object" && obj.settings !== null ? obj.settings : {},
  );
  return {
    ok: true,
    doc: repairDoc(docResult.data as Doc),
    settings: settings as Settings,
  };
}
