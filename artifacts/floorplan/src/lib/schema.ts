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
const KIND_RE = /^[a-z0-9][a-z0-9_-]{0,59}$/i;

// Zod 4 already rejects NaN / ±Infinity in z.number().
const num = z.number().min(-MAX_COORD).max(MAX_COORD);
const positive = (max: number) => z.number().positive().max(max);
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
  kind: z.string().regex(KIND_RE),
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

const importSchema = z
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

type ImportData = z.infer<typeof importSchema>;

// ------------------------------------------------------- Spanish messages
const TYPE_ES: Record<string, string> = {
  string: "texto",
  number: "número",
  boolean: "verdadero/falso",
  array: "lista",
  object: "objeto",
};

type RawIssue = {
  code: string;
  input?: unknown;
  expected?: string;
  origin?: string;
  minimum?: number | bigint;
  maximum?: number | bigint;
  inclusive?: boolean;
  message?: string;
};

/** Spanish messages for the issues users can realistically trigger. */
const esError = (issue: RawIssue): string | undefined => {
  switch (issue.code) {
    case "invalid_type":
      return issue.input === undefined
        ? "es obligatorio"
        : `debe ser ${TYPE_ES[issue.expected ?? ""] ?? issue.expected ?? "otro tipo"}`;
    case "too_small":
      if (issue.origin === "string") return "está vacío";
      if (issue.origin === "array") return "faltan elementos";
      return issue.inclusive
        ? `debe ser ≥ ${String(issue.minimum)}`
        : `debe ser mayor que ${String(issue.minimum)}`;
    case "too_big":
      if (issue.origin === "string") {
        return `es demasiado largo (máx. ${String(issue.maximum)})`;
      }
      if (issue.origin === "array") {
        return `tiene demasiados elementos (máx. ${String(issue.maximum)})`;
      }
      return `debe ser ≤ ${String(issue.maximum)}`;
    case "invalid_format":
      return "tiene un formato no válido";
    case "invalid_value":
      return "tiene un valor no permitido";
    case "custom":
      return issue.message;
    default:
      return undefined; // fall back to Zod's default message
  }
};

function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (acc, seg) =>
      typeof seg === "number"
        ? `${acc}[${seg + 1}]`
        : acc
          ? `${acc}.${String(seg)}`
          : String(seg),
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

const IMPORT_LISTS = ["walls", "doors", "windows", "furniture", "texts"] as const;

/**
 * Zod validates every element of an array before it checks `.max()`, so a small
 * file with millions of items could freeze the tab (CPU + memory). Cheap
 * structural size checks therefore run BEFORE the schema.
 */
function assertImportSizes(raw: unknown): void {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return;
  for (const key of IMPORT_LISTS) {
    const list = (raw as Record<string, unknown>)[key];
    if (Array.isArray(list) && list.length > MAX_ITEMS) {
      throw new ImportError(
        `Hay demasiados elementos en «${key}» (máx. ${MAX_ITEMS}).`,
      );
    }
  }
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
  assertImportSizes(raw);
  const result = importSchema.safeParse(raw, { error: (iss) => esError(iss as RawIssue) });
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
  kind: z.string().regex(KIND_RE),
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
    if (
      Object.hasOwn(doc.nodes, w.a) &&
      Object.hasOwn(doc.nodes, w.b) &&
      w.a !== w.b
    ) {
      out.walls[id] = w;
    }
  }
  for (const [id, o] of Object.entries(doc.doors)) {
    if (Object.hasOwn(out.walls, o.wallId)) out.doors[id] = o;
  }
  for (const [id, o] of Object.entries(doc.windows)) {
    if (Object.hasOwn(out.walls, o.wallId)) out.windows[id] = o;
  }
  return out;
}

type StoredParse =
  | { ok: true; doc: Doc; settings: Settings }
  | { ok: false; reason: string };

/** Validate the object restored from localStorage. */
export function parseStored(raw: unknown): StoredParse {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "estructura inesperada" };
  }
  const obj = raw as { doc?: unknown; settings?: unknown };
  // Same guard as for imports: bound the work Zod has to do on stored data.
  if (typeof obj.doc === "object" && obj.doc !== null) {
    for (const value of Object.values(obj.doc)) {
      if (
        typeof value === "object" &&
        value !== null &&
        Object.keys(value).length > MAX_ITEMS * 2
      ) {
        return { ok: false, reason: "demasiados elementos" };
      }
    }
  }
  const docResult = storedDocSchema.safeParse(obj.doc ?? {}, {
    error: (iss) => esError(iss as RawIssue),
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
