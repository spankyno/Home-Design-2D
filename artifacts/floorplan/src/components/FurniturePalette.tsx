import { useMemo, useState } from "react";
import { FURNITURE_CATEGORIES, furnitureSymbol } from "../lib/furniture";
import { furnitureCategory, furnitureName } from "../lib/spanish";

function Thumb({ kind, w, h }: { kind: string; w: number; h: number }) {
  const prims = furnitureSymbol(kind, w, h);
  const pad = 6;
  const scale = Math.min((36 - pad * 2) / w, (36 - pad * 2) / h);
  return (
    <svg viewBox="-18 -18 36 36" width={36} height={36} aria-hidden>
      <g transform={`scale(${scale})`}>
        {prims.map((p, i) => {
          const sw = 1.2 / scale;
          if (p.t === "rect")
            return (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx={p.rx}
                fill={p.fill ?? "none"}
                stroke="#111"
                strokeWidth={sw}
              />
            );
          if (p.t === "line")
            return (
              <line
                key={i}
                x1={p.x1}
                y1={p.y1}
                x2={p.x2}
                y2={p.y2}
                stroke="#111"
                strokeWidth={sw}
              />
            );
          if (p.t === "circle")
            return (
              <circle
                key={i}
                cx={p.cx}
                cy={p.cy}
                r={p.r}
                fill={p.fill ?? "none"}
                stroke="#111"
                strokeWidth={sw}
              />
            );
          if (p.t === "ellipse")
            return (
              <ellipse
                key={i}
                cx={p.cx}
                cy={p.cy}
                rx={p.rx}
                ry={p.ry}
                fill={p.fill ?? "none"}
                stroke="#111"
                strokeWidth={sw}
              />
            );
          if (p.t === "path")
            return (
              <path
                key={i}
                d={p.d}
                fill={p.fill ?? "none"}
                stroke="#111"
                strokeWidth={sw}
              />
            );
          return null;
        })}
      </g>
    </svg>
  );
}

export default function FurniturePalette({
  onPick,
}: {
  onPick: (kind: string) => void;
}) {
  const [query, setQuery] = useState("");

  const categories = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FURNITURE_CATEGORIES;
    return FURNITURE_CATEGORIES.map((cat) => ({
      name: cat.name,
      items: cat.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          furnitureName(item.label).toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          furnitureCategory(item.category).toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [query]);

  return (
    <div className="furn-palette" role="menu">
      <div className="furn-palette-head">Mobiliario</div>
      <div className="furn-search">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar mobiliario…"
          aria-label="Buscar mobiliario"
          autoFocus
        />
      </div>
      <div className="furn-palette-scroll">
        {categories.length === 0 ? (
          <div className="furn-empty">No se encontró mobiliario</div>
        ) : (
          categories.map((cat) => (
              <div key={cat.name} className="furn-cat">
              <div className="furn-cat-name">{furnitureCategory(cat.name)}</div>
              <div className="furn-grid">
                {cat.items.map((item) => (
                  <button
                    key={item.kind}
                    className="furn-item"
                    onClick={() => onPick(item.kind)}
                    title={furnitureName(item.label)}
                  >
                    <Thumb kind={item.kind} w={item.w} h={item.h} />
                    <span>{furnitureName(item.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
