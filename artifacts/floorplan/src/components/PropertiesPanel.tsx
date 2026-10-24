import { useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import type { ObjectStyle } from "../types";
import { wallGeom } from "../lib/render";
import { dist, angleDeg } from "../lib/geometry";
import {
  formatArea,
  formatLen,
  parseLen,
  toDisplay,
  displayStep,
} from "../lib/units";
import { Trash2 } from "lucide-react";
import ColorPicker from "./ColorPicker";
import { DEFAULT_FURNITURE_FILL, DEFAULT_STROKE, safeColor } from "../lib/appearance";

function NumberField({
  label,
  value,
  suffix,
  onCommit,
  step = 1,
}: {
  label: string;
  value: number;
  suffix?: string;
  onCommit: (v: number) => void;
  step?: number;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(Math.round(value * 100) / 100));
  }, [value]);
  const commit = () => {
    const v = parseFloat(text);
    if (!Number.isNaN(v)) onCommit(v);
    else setText(String(Math.round(value * 100) / 100));
  };
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        <input
          type="number"
          step={step}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {suffix && <span className="suffix">{suffix}</span>}
      </div>
    </label>
  );
}

function LabelField({
  label = "Nombre",
  value,
  beginChange,
  onLive,
}: {
  label?: string;
  value: string;
  beginChange: () => void;
  onLive: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const changed = useRef(false);
  useEffect(() => {
    setText(value);
  }, [value]);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        <input
          type="text"
          value={text}
          placeholder={label}
          onChange={(e) => {
            if (!changed.current) {
              beginChange();
              changed.current = true;
            }
            setText(e.target.value);
            onLive(e.target.value);
          }}
          onBlur={() => {
            changed.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>
    </label>
  );
}

function ColorField({
  label,
  value,
  fallback,
  beginChange,
  onLive,
}: {
  label: string;
  value?: string;
  fallback: string;
  beginChange: () => void;
  onLive: (value: string) => void;
}) {
  return (
    <div className="field color-field">
      <span>{label}</span>
      <ColorPicker
        label={label}
        value={safeColor(value, fallback)}
        onBegin={beginChange}
        onChange={onLive}
      />
    </div>
  );
}

function AppearanceControls({
  type,
  id,
  style,
  canFill,
}: {
  type: "wall" | "door" | "window" | "furniture" | "text";
  id: string;
  style: ObjectStyle;
  canFill: boolean;
}) {
  const { beginChange, setAppearance, setAppearanceLive } = useStore();
  const [hasGradient, setHasGradient] = useState(Boolean(style.gradientColor));
  useEffect(() => setHasGradient(Boolean(style.gradientColor)), [style.gradientColor]);
  return (
    <div className="appearance-controls">
      <div className="field-label">Apariencia</div>
      <ColorField
        label={type === "text" ? "Color del texto" : "Color de línea"}
        value={style.color}
        fallback={DEFAULT_STROKE}
        beginChange={beginChange}
        onLive={(color) => setAppearanceLive(type, id, { color })}
      />
      {canFill && (
        <ColorField
          label="Relleno"
          value={style.fillColor}
          fallback={DEFAULT_FURNITURE_FILL}
          beginChange={beginChange}
          onLive={(fillColor) => setAppearanceLive(type, id, { fillColor })}
        />
      )}
      <label className="field gradient-toggle">
        <span>Degradado</span>
        <input
          type="checkbox"
          checked={hasGradient}
          onChange={(e) => {
            const enabled = e.target.checked;
            setHasGradient(enabled);
            setAppearance(type, id, {
              gradientColor: enabled ? "#2563eb" : undefined,
            });
          }}
        />
      </label>
      {hasGradient && (
        <ColorField
          label="Color final"
          value={style.gradientColor}
          fallback="#2563eb"
          beginChange={beginChange}
          onLive={(gradientColor) =>
            setAppearanceLive(type, id, { gradientColor })
          }
        />
      )}
      <label className="field">
        <span>Efecto</span>
        <select
          className="style-select"
          value={style.effect ?? "none"}
          onChange={(e) =>
            setAppearance(type, id, {
              effect: e.target.value as ObjectStyle["effect"],
            })
          }
        >
          <option value="none">Ninguno</option>
          <option value="shadow">Sombra</option>
          <option value="glow">Resplandor</option>
        </select>
      </label>
      <div className="style-hint">
        El degradado combina el color principal con el color final.
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const {
    doc,
    rooms,
    settings,
    selection,
    setWallLength,
    setWallAngle,
    setWallThickness,
    setNodePosCommitted,
    setOpening,
    setFurniture,
    setFurnitureLive,
    beginChange,
    setText,
    setTextLive,
    reorderFurniture,
    deleteById,
  } = useStore();

  if (!selection) return null;
  const unit = settings.unit;
  const lenSuffix = unit;

  let body: React.ReactNode = null;
  let title = "";

  if (selection.type === "wall") {
    const w = doc.walls[selection.id];
    const g = w ? wallGeom(doc, selection.id) : null;
    if (!w || !g) return null;
    title = "Pared";
    const len = g.len;
    const deg = angleDeg(g.ax, g.ay, g.bx, g.by);
    body = (
      <>
        <NumberField
          label="Longitud"
          value={toDisplay(len, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setWallLength(selection.id, cm);
          }}
        />
        <NumberField
          label="Ángulo"
          value={Math.round(deg * 10) / 10}
          suffix="°"
          step={1}
          onCommit={(v) => setWallAngle(selection.id, v)}
        />
        <NumberField
          label="Grosor"
          value={w.thickness}
          suffix="cm"
          step={1}
          onCommit={(v) => setWallThickness(selection.id, v)}
        />
        <AppearanceControls
          type="wall"
          id={selection.id}
          style={w}
          canFill={false}
        />
      </>
    );
  } else if (selection.type === "node") {
    const n = doc.nodes[selection.id];
    if (!n) return null;
    title = "Punto";
    body = (
      <>
        <NumberField
          label="X"
          value={toDisplay(n.x, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setNodePosCommitted(selection.id, cm, n.y);
          }}
        />
        <NumberField
          label="Y"
          value={toDisplay(n.y, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setNodePosCommitted(selection.id, n.x, cm);
          }}
        />
      </>
    );
  } else if (selection.type === "door" || selection.type === "window") {
    const kind = selection.type;
    const map = kind === "door" ? doc.doors : doc.windows;
    const op = map[selection.id];
    if (!op) return null;
    const g = wallGeom(doc, op.wallId);
    title = kind === "door" ? "Puerta" : "Ventana";
    body = (
      <>
        <NumberField
          label="Ancho"
          value={toDisplay(op.width, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setOpening(kind, selection.id, { width: cm });
          }}
        />
        <NumberField
          label="Posición"
          value={toDisplay(op.offset, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setOpening(kind, selection.id, { offset: cm });
          }}
        />
        {kind === "door" && (
          <div className="field-row">
            <button
              type="button"
              className="ghost-btn"
              onClick={() =>
                setOpening("door", selection.id, { flipX: !op.flipX })
              }
            >
              Cambiar bisagra
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() =>
                setOpening("door", selection.id, { flipY: !op.flipY })
              }
            >
              Invertir apertura
            </button>
          </div>
        )}
        {g && (
          <div className="readout">
            En la pared · {formatLen(g.len, unit)}
          </div>
        )}
        <AppearanceControls
          type={kind}
          id={selection.id}
          style={op}
          canFill={false}
        />
      </>
    );
  } else if (selection.type === "furniture") {
    const f = doc.furniture[selection.id];
    if (!f) return null;
    title = "Mobiliario";
    body = (
      <>
        {f.kind === "custom" && (
          <LabelField
            label="Nombre"
            value={f.label ?? ""}
            beginChange={beginChange}
            onLive={(v) => setFurnitureLive(selection.id, { label: v })}
          />
        )}
        <NumberField
          label="X"
          value={toDisplay(f.x, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setFurniture(selection.id, { x: cm });
          }}
        />
        <NumberField
          label="Y"
          value={toDisplay(f.y, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setFurniture(selection.id, { y: cm });
          }}
        />
        <NumberField
          label="Ancho"
          value={toDisplay(f.w, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setFurniture(selection.id, { w: cm });
          }}
        />
        <NumberField
          label="Fondo"
          value={toDisplay(f.h, unit)}
          suffix={lenSuffix}
          step={displayStep(unit)}
          onCommit={(v) => {
            const cm = parseLen(String(v), unit);
            if (cm != null) setFurniture(selection.id, { h: cm });
          }}
        />
        <NumberField
          label="Rotación"
          value={Math.round(f.rotation * 10) / 10}
          suffix="°"
          step={1}
          onCommit={(v) => setFurniture(selection.id, { rotation: v })}
        />
        <div className="field-row">
          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              setFurniture(selection.id, { rotation: f.rotation - 90 })
            }
          >
            Girar −90°
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() =>
              setFurniture(selection.id, { rotation: f.rotation + 90 })
            }
          >
            Girar +90°
          </button>
        </div>
        <AppearanceControls
          type="furniture"
          id={selection.id}
          style={f}
          canFill
        />
        <div className="field-label">Orden de capas</div>
        <div className="field-row">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => reorderFurniture(selection.id, "front")}
          >
            Traer al frente
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => reorderFurniture(selection.id, "back")}
          >
            Enviar atrás
          </button>
        </div>
        <div className="field-row">
          <button
            type="button"
            className="ghost-btn"
            onClick={() => reorderFurniture(selection.id, "forward")}
          >
            Adelantar
          </button>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => reorderFurniture(selection.id, "backward")}
          >
            Retrasar
          </button>
        </div>
      </>
    );
  } else if (selection.type === "text") {
    const item = doc.texts[selection.id];
    if (!item) return null;
    title = "Texto";
    body = (
      <>
        <LabelField
          label="Contenido"
          value={item.text}
          beginChange={beginChange}
          onLive={(text) => setTextLive(selection.id, { text })}
        />
        <NumberField
          label="Tamaño"
          value={item.fontSize}
          suffix="cm"
          step={1}
          onCommit={(fontSize) => setText(selection.id, { fontSize })}
        />
        <NumberField
          label="Rotación"
          value={Math.round(item.rotation * 10) / 10}
          suffix="°"
          step={1}
          onCommit={(rotation) => setText(selection.id, { rotation })}
        />
        <AppearanceControls
          type="text"
          id={selection.id}
          style={item}
          canFill={false}
        />
      </>
    );
  } else if (selection.type === "room") {
    const room = rooms.find((r) => r.id === selection.id);
    if (!room) return null;
    title = "Habitación";
    let perimeter = 0;
    for (let i = 0; i < room.points.length; i++) {
      const a = room.points[i];
      const b = room.points[(i + 1) % room.points.length];
      perimeter += dist(a.x, a.y, b.x, b.y);
    }
    body = (
      <>
        <div className="readout big">{formatArea(room.area, unit)}</div>
        <div className="readout">Perímetro · {formatLen(perimeter, unit)}</div>
        <div className="readout">{room.points.length} esquinas</div>
      </>
    );
  }

  const canDelete =
    selection.type === "wall" ||
    selection.type === "node" ||
    selection.type === "door" ||
    selection.type === "window" ||
    selection.type === "furniture" ||
    selection.type === "text";

  return (
    <div className="props">
      <div className="props-title">{title}</div>
      <div className="props-body">{body}</div>
      {canDelete && (
        <button
          className="delete-btn"
          onClick={() =>
            deleteById(
              selection.type as
                | "wall"
                | "node"
                | "door"
                | "window"
                | "furniture"
                | "text",
              selection.id,
            )
          }
        >
          <Trash2 size={14} strokeWidth={1.75} /> Eliminar
        </button>
      )}
    </div>
  );
}
