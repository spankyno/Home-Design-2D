import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  MousePointer2,
  Hand,
  PenLine,
  DoorOpen,
  Ruler,
  Pentagon,
  Eraser,
  Sofa,
  Type,
} from "lucide-react";
import { useStore } from "../store";
import type { Tool } from "../types";
import FurniturePalette from "./FurniturePalette";
import { TOOL_META } from "../lib/shortcuts";

// A real house window: outer frame, sill, and cross mullions.
function HouseWindow({
  size = 24,
  strokeWidth = 2,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="2" y1="21" x2="22" y2="21" />
    </svg>
  );
}

const TOOL_ICONS: {
  tool: Tool;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}[] = [
  { tool: "select", icon: MousePointer2 },
  { tool: "pan", icon: Hand },
  { tool: "wall", icon: PenLine },
  { tool: "door", icon: DoorOpen },
  { tool: "window", icon: HouseWindow },
  { tool: "text", icon: Type },
  { tool: "measure", icon: Ruler },
  { tool: "area", icon: Pentagon },
  { tool: "delete", icon: Eraser },
];

export default function Toolbar() {
  const { tool, setTool, addFurnitureAtViewCenter } = useStore();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const furnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!furnRef.current?.contains(e.target as Node)) setPaletteOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [paletteOpen]);
  return (
    <div className="toolbar">
      {TOOL_ICONS.map((t) => {
        const Icon = t.icon;
        const meta = TOOL_META[t.tool];
        const active = tool === t.tool;
        return (
          <button
            key={t.tool}
            className={`tool-btn${active ? " active" : ""}`}
            onClick={() => {
              setTool(t.tool);
              setPaletteOpen(false);
            }}
            data-tip={`${meta.label} (${meta.key})`}
            aria-label={meta.label}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        );
      })}
      <div className="toolbar-sep" />
      <div className="toolbar-furn" ref={furnRef}>
        <button
          className={`tool-btn${paletteOpen ? " active" : ""}`}
          onClick={() => setPaletteOpen((o) => !o)}
          data-tip="Mobiliario"
          aria-label="Mobiliario"
        >
          <Sofa size={18} strokeWidth={1.75} />
        </button>
        {paletteOpen && (
          <FurniturePalette
            onPick={(kind) => {
              addFurnitureAtViewCenter(kind);
              setPaletteOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
}
