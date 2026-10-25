import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * Custom colour picker.
 *
 * The native <input type="color"> popup is anchored by the browser to the
 * input and cannot be styled or constrained, so inside the right-docked
 * properties panel it ended up clipped by the viewport. This picker is
 * rendered in a portal on <body> and positioned with `position: fixed`,
 * clamped to the viewport on every side (and flipped above the trigger when
 * there is no room below), so it is always fully visible.
 */

const POPOVER_W = 216;
const MARGIN = 8;
const GAP = 6;

const PRESETS = [
  "#111111",
  "#4b5563",
  "#9ca3af",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#2563eb",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#8b5a2b",
  "#d6b88a",
  "#fde68a",
  "#bbf7d0",
  "#bfdbfe",
  "#fbcfe8",
];

interface HSV {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

function hexToHsv(hex: string): HSV {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: HSV): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function normalizeHex(text: string): string | null {
  const t = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t)) {
    return `#${t
      .split("")
      .map((c) => c + c)
      .join("")
      .toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(t)) return `#${t.toLowerCase()}`;
  return null;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface Props {
  label: string;
  value: string; // #rrggbb
  /** Called once at the start of each edit gesture (for undo history). */
  onBegin: () => void;
  /** Called with every new colour while editing. */
  onChange: (hex: string) => void;
}

export default function ColorPicker({ label, value, onBegin, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const [hexText, setHexText] = useState(value.toUpperCase());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Keep the local HSV / hex text in sync with external changes while
  // preserving the hue when the colour is grey (s = 0 or v = 0).
  useEffect(() => {
    setHsv((cur) => (hsvToHex(cur) === value ? cur : hexToHsv(value)));
    setHexText(value.toUpperCase());
  }, [value]);

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(POPOVER_W, vw - MARGIN * 2);
    const h = popRef.current?.offsetHeight ?? 300;

    // Align the popover's right edge with the trigger's, then clamp so it is
    // fully inside the viewport horizontally.
    let left = r.right - w;
    left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));

    // Prefer below the trigger; flip above if it does not fit; finally clamp.
    let top = r.bottom + GAP;
    if (top + h > vh - MARGIN) {
      const above = r.top - GAP - h;
      top = above >= MARGIN ? above : vh - h - MARGIN;
    }
    top = Math.max(MARGIN, top);
    setPos({ left, top });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
    // Re-place once content has been measured / on any viewport change.
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const apply = (next: HSV) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };

  // ---- saturation / value square ----
  const onSvDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onBegin();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateSv(e);
  };
  const updateSv = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    apply({
      h: hsv.h,
      s: clamp01((e.clientX - r.left) / r.width),
      v: 1 - clamp01((e.clientY - r.top) / r.height),
    });
  };

  // ---- hue slider ----
  const onHueDown = (e: React.PointerEvent<HTMLDivElement>) => {
    onBegin();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateHue(e);
  };
  const updateHue = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    apply({ ...hsv, h: clamp01((e.clientX - r.left) / r.width) * 359.999 });
  };

  const pickPreset = (hex: string) => {
    onBegin();
    setHsv(hexToHsv(hex));
    onChange(hex);
  };

  const commitHex = () => {
    const hex = normalizeHex(hexText);
    if (!hex) {
      setHexText(value.toUpperCase());
      return;
    }
    if (hex !== value) {
      onBegin();
      setHsv(hexToHsv(hex));
      onChange(hex);
    }
    setHexText(hex.toUpperCase());
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="color-trigger"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="color-swatch" style={{ background: value }} />
        <span className="color-hex">{value.toUpperCase()}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            className="color-popover"
            role="dialog"
            aria-label={label}
            style={{
              left: pos?.left ?? 0,
              top: pos?.top ?? 0,
              width: Math.min(POPOVER_W, window.innerWidth - MARGIN * 2),
              visibility: pos ? "visible" : "hidden",
            }}
          >
            <div
              className="cp-sv"
              style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
              onPointerDown={onSvDown}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) updateSv(e);
              }}
            >
              <span
                className="cp-knob"
                style={{
                  left: `${hsv.s * 100}%`,
                  top: `${(1 - hsv.v) * 100}%`,
                  background: value,
                }}
              />
            </div>
            <div
              className="cp-hue"
              onPointerDown={onHueDown}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId))
                  updateHue(e);
              }}
            >
              <span
                className="cp-knob"
                style={{
                  left: `${(hsv.h / 360) * 100}%`,
                  top: "50%",
                  background: `hsl(${hsv.h} 100% 50%)`,
                }}
              />
            </div>
            <div className="cp-presets">
              {PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`cp-preset${c === value ? " on" : ""}`}
                  style={{ background: c }}
                  aria-label={c}
                  title={c.toUpperCase()}
                  onClick={() => pickPreset(c)}
                />
              ))}
            </div>
            <label className="cp-hex">
              <span>HEX</span>
              <input
                type="text"
                value={hexText}
                maxLength={7}
                spellCheck={false}
                onChange={(e) => setHexText(e.target.value)}
                onBlur={commitHex}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
              />
            </label>
          </div>,
          document.body,
        )}
    </>
  );
}
