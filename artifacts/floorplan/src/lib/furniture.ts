// Shared, top-down architectural furniture symbols. Each symbol is drawn in
// local coordinates centred at (0,0) inside a footprint of width `w` and depth
// `h` (x from -w/2..w/2, y from -h/2..h/2). The same primitive list is rendered
// to React SVG on the canvas and to an SVG string in the exporters.
//
// Style: fine black line work on a white fill (CAD plan symbols), drawn strictly
// as a top-down/plan view — no elevation (front/side) detail. Bodies are filled
// white so they cleanly occlude walls/rooms beneath; interior detail is drawn as
// outlines (no fill). The only solid fill is BLACK, reserved for foliage
// (plants / bushes) and piano keys.

export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill?: string }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number }
  | { t: "circle"; cx: number; cy: number; r: number; fill?: string }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill?: string }
  | { t: "path"; d: string; fill?: string }
  | { t: "polyline"; pts: number[] };

interface FurnitureDef {
  kind: string;
  label: string;
  category: string;
  w: number; // default footprint width (cm)
  h: number; // default footprint depth (cm)
  draw: (w: number, h: number) => Prim[];
}

const WHITE = "#ffffff";
const BLACK = "#111111"; // solid foliage only

// helpers ---------------------------------------------------------------
const r = (x: number, y: number, w: number, h: number, rx?: number, fill?: string): Prim => ({
  t: "rect",
  x,
  y,
  w,
  h,
  rx,
  fill,
});
const ln = (x1: number, y1: number, x2: number, y2: number): Prim => ({
  t: "line",
  x1,
  y1,
  x2,
  y2,
});
const ci = (cx: number, cy: number, rad: number, fill?: string): Prim => ({
  t: "circle",
  cx,
  cy,
  r: rad,
  fill,
});
const el = (cx: number, cy: number, rx: number, ry: number, fill?: string): Prim => ({
  t: "ellipse",
  cx,
  cy,
  rx,
  ry,
  fill,
});
const pth = (d: string, fill?: string): Prim => ({ t: "path", d, fill });

const n1 = (v: number) => v.toFixed(1);

// body covering the whole footprint (white, so it occludes what's beneath)
const body = (w: number, h: number, rx = 0): Prim => r(-w / 2, -h / 2, w, h, rx, WHITE);

// a spiky radial burst (star polygon), used for foliage
const burst = (
  cx: number,
  cy: number,
  R: number,
  points: number,
  innerRatio: number,
  fill: string,
): Prim => {
  const total = points * 2;
  let d = "";
  for (let i = 0; i < total; i++) {
    const rad = i % 2 === 0 ? R : R * innerRatio;
    const a = (i / total) * Math.PI * 2 - Math.PI / 2;
    d += `${i === 0 ? "M" : "L"} ${n1(cx + Math.cos(a) * rad)} ${n1(cy + Math.sin(a) * rad)} `;
  }
  return pth(d + "Z", fill);
};

// kitchen plan helpers (top-down) ---------------------------------------
// evenly spaced cabinet divisions across a horizontal run
const vDivs = (x0: number, x1: number, yTop: number, yBot: number, step: number): Prim[] => {
  const prims: Prim[] = [];
  const n = Math.max(1, Math.round((x1 - x0) / step));
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) / n) * i;
    prims.push(ln(x, yTop, x, yBot));
  }
  return prims;
};
// evenly spaced cabinet divisions down a vertical run
const hDivs = (y0: number, y1: number, xL: number, xR: number, step: number): Prim[] => {
  const prims: Prim[] = [];
  const n = Math.max(1, Math.round((y1 - y0) / step));
  for (let i = 1; i < n; i++) {
    const y = y0 + ((y1 - y0) / n) * i;
    prims.push(ln(xL, y, xR, y));
  }
  return prims;
};
// 4-burner cooktop set into the counter (white backing hides cabinet lines)
const cooktop = (cx: number, cy: number, s: number): Prim[] => {
  const prims: Prim[] = [r(cx - s / 2, cy - s / 2, s, s, 2, WHITE)];
  const o = s * 0.23;
  for (const dx of [-o, o])
    for (const dy of [-o, o]) {
      prims.push(ci(cx + dx, cy + dy, s * 0.12));
      prims.push(ci(cx + dx, cy + dy, s * 0.055));
    }
  return prims;
};
// double-basin sink set into the counter; faucet toward the wall side
const ksink = (cx: number, cy: number, sw: number, sh: number, faucetUp: boolean): Prim[] => {
  const prims: Prim[] = [r(cx - sw / 2, cy - sh / 2, sw, sh, 3, WHITE)];
  prims.push(r(cx - sw / 2 + 3, cy - sh / 2 + 3, sw / 2 - 5, sh - 6, 2));
  prims.push(r(cx + 2, cy - sh / 2 + 3, sw / 2 - 5, sh - 6, 2));
  const fy = faucetUp ? cy - sh / 2 - 2 : cy + sh / 2 + 2;
  prims.push(ci(cx, fy, 2.5));
  return prims;
};
// fridge footprint set into the counter run
const fridgeBox = (cx: number, cy: number, s: number): Prim[] => [
  r(cx - s / 2, cy - s / 2, s, s, 0, WHITE),
  r(cx - s / 2 + 3, cy - s / 2 + 3, s - 6, s - 6, 0),
  ln(cx - s / 2 + 3, cy + s / 2 - 8, cx + s / 2 - 3, cy + s / 2 - 8),
];

// catalog ---------------------------------------------------------------
const FURNITURE: FurnitureDef[] = [
  // ---- Custom ----
  {
    kind: "custom",
    label: "Custom box",
    category: "Custom",
    w: 120,
    h: 120,
    draw: (w, h) => [body(w, h, 4)],
  },

  // ---- Bedroom ----
  {
    kind: "bed-single",
    label: "Single bed",
    category: "Bedroom",
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 4)];
      // pillow at the head (top)
      prims.push(r(-w / 2 + 6, -h / 2 + 6, w - 12, h * 0.13, 5));
      // turned-down sheet line under pillow
      prims.push(ln(-w / 2 + 4, -h / 2 + h * 0.24, w / 2 - 4, -h / 2 + h * 0.24));
      // duvet wrinkle folds (gentle curves)
      for (const f of [0.36, 0.52, 0.68]) {
        prims.push(
          pth(
            `M ${n1(-w / 2 + 5)} ${n1(-h / 2 + h * f)} Q ${n1(0)} ${n1(-h / 2 + h * (f - 0.04))} ${n1(w / 2 - 5)} ${n1(-h / 2 + h * f)}`,
          ),
        );
      }
      // folded-back corner at the foot
      prims.push(
        pth(
          `M ${n1(w / 2 - 4)} ${n1(h / 2 - h * 0.16)} L ${n1(w / 2 - 4)} ${n1(h / 2 - 4)} L ${n1(w / 2 - w * 0.42)} ${n1(h / 2 - 4)} Z`,
        ),
      );
      return prims;
    },
    w: 90,
    h: 200,
  },
  {
    kind: "bed-double",
    label: "Double bed",
    category: "Bedroom",
    w: 160,
    h: 200,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 4)];
      // two pillows
      prims.push(r(-w / 2 + 6, -h / 2 + 6, w / 2 - 10, h * 0.13, 5));
      prims.push(r(4, -h / 2 + 6, w / 2 - 10, h * 0.13, 5));
      // turned-down sheet line
      prims.push(ln(-w / 2 + 4, -h / 2 + h * 0.24, w / 2 - 4, -h / 2 + h * 0.24));
      // centre seam of the duvet
      prims.push(ln(0, -h / 2 + h * 0.24, 0, h / 2 - 4));
      // wrinkle folds on each half
      for (const f of [0.36, 0.54, 0.72]) {
        prims.push(
          pth(
            `M ${n1(-w / 2 + 5)} ${n1(-h / 2 + h * f)} Q ${n1(-w / 4)} ${n1(-h / 2 + h * (f - 0.04))} ${n1(-3)} ${n1(-h / 2 + h * f)}`,
          ),
        );
        prims.push(
          pth(
            `M ${n1(3)} ${n1(-h / 2 + h * f)} Q ${n1(w / 4)} ${n1(-h / 2 + h * (f - 0.04))} ${n1(w / 2 - 5)} ${n1(-h / 2 + h * f)}`,
          ),
        );
      }
      return prims;
    },
  },
  {
    kind: "nightstand",
    label: "Nightstand",
    category: "Bedroom",
    w: 45,
    h: 45,
    draw: (w, h) => [
      body(w, h, 2),
      // drawer front edge (flat top view)
      ln(-w / 2 + 4, h / 2 - h * 0.28, w / 2 - 4, h / 2 - h * 0.28),
      // lamp footprint on top
      ci(0, -h * 0.08, Math.min(w, h) * 0.2),
    ],
  },
  {
    kind: "wardrobe",
    label: "Wardrobe",
    category: "Bedroom",
    w: 120,
    h: 60,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      // double doors
      prims.push(ln(0, -h / 2, 0, h / 2));
      // hanging rod (rear)
      prims.push(ln(-w / 2 + 6, -h / 2 + 7, w / 2 - 6, -h / 2 + 7));
      // hanger ticks
      for (let i = 1; i <= 8; i++) {
        const x = -w / 2 + (w / 9) * i;
        prims.push(ln(x, -h / 2 + 7, x, -h / 2 + 13));
      }
      return prims;
    },
  },
  {
    kind: "dresser",
    label: "Dresser",
    category: "Bedroom",
    w: 100,
    h: 50,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      // drawer bank front edge (flat top view)
      prims.push(ln(-w / 2, h / 2 - h * 0.34, w / 2, h / 2 - h * 0.34));
      return prims;
    },
  },
  {
    kind: "crib",
    label: "Crib",
    category: "Bedroom",
    w: 70,
    h: 130,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 6)];
      // inner mattress
      prims.push(r(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 4));
      // spindle ticks along the long sides
      for (let i = 1; i < 12; i++) {
        const y = -h / 2 + (h / 12) * i;
        prims.push(ln(-w / 2, y, -w / 2 + 7, y));
        prims.push(ln(w / 2, y, w / 2 - 7, y));
      }
      return prims;
    },
  },

  // ---- Living ----
  {
    kind: "sofa",
    label: "Sofa",
    category: "Living",
    w: 220,
    h: 90,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 10)];
      const aw = w * 0.09; // arm width
      // rolled arms
      prims.push(r(-w / 2, -h / 2, aw, h, 9));
      prims.push(r(w / 2 - aw, -h / 2, aw, h, 9));
      const inX = -w / 2 + aw;
      const inW = w - 2 * aw;
      const n = 3;
      const cw = inW / n;
      // back cushions
      for (let i = 0; i < n; i++) prims.push(r(inX + i * cw + 2, -h / 2 + 3, cw - 4, h * 0.32, 5));
      // seat cushions
      for (let i = 0; i < n; i++)
        prims.push(r(inX + i * cw + 2, -h / 2 + h * 0.4, cw - 4, h * 0.56, 5));
      return prims;
    },
  },
  {
    kind: "loveseat",
    label: "Loveseat",
    category: "Living",
    w: 150,
    h: 90,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 10)];
      const aw = w * 0.12;
      prims.push(r(-w / 2, -h / 2, aw, h, 9));
      prims.push(r(w / 2 - aw, -h / 2, aw, h, 9));
      const inX = -w / 2 + aw;
      const inW = w - 2 * aw;
      const cw = inW / 2;
      for (let i = 0; i < 2; i++) prims.push(r(inX + i * cw + 2, -h / 2 + 3, cw - 4, h * 0.32, 5));
      for (let i = 0; i < 2; i++)
        prims.push(r(inX + i * cw + 2, -h / 2 + h * 0.4, cw - 4, h * 0.56, 5));
      return prims;
    },
  },
  {
    kind: "armchair",
    label: "Armchair",
    category: "Living",
    w: 90,
    h: 90,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 10)];
      const aw = w * 0.18;
      prims.push(r(-w / 2, -h / 2, aw, h, 9));
      prims.push(r(w / 2 - aw, -h / 2, aw, h, 9));
      // back cushion
      prims.push(r(-w / 2 + aw + 2, -h / 2 + 3, w - 2 * aw - 4, h * 0.32, 5));
      // seat cushion
      prims.push(r(-w / 2 + aw + 2, -h / 2 + h * 0.4, w - 2 * aw - 4, h * 0.56, 5));
      return prims;
    },
  },
  {
    kind: "sectional",
    label: "Sectional",
    category: "Living",
    w: 250,
    h: 180,
    draw: (w, h) => {
      const prims: Prim[] = [];
      const aw = w * 0.07;
      const topH = h * 0.46;
      const chW = w * 0.42; // chaise (vertical) part width, on the right
      // L-shaped outline (two overlapping rounded rects)
      prims.push(r(-w / 2, -h / 2, w, topH, 10, WHITE));
      prims.push(r(w / 2 - chW, -h / 2, chW, h, 10, WHITE));
      // left arm + back of the horizontal run
      prims.push(r(-w / 2, -h / 2, aw, topH, 8));
      // back cushions along the top run
      const inX = -w / 2 + aw;
      const inW = w - aw - chW;
      const bn = 3;
      const bcw = inW / bn;
      for (let i = 0; i < bn; i++)
        prims.push(r(inX + i * bcw + 2, -h / 2 + 3, bcw - 4, topH * 0.34, 5));
      // seat cushions of the top run
      for (let i = 0; i < bn; i++)
        prims.push(r(inX + i * bcw + 2, -h / 2 + topH * 0.42, bcw - 4, topH * 0.54, 5));
      // chaise seat cushions (stacked down the right)
      const cy0 = -h / 2 + topH;
      const cn = 2;
      const cch = (h - topH) / cn;
      for (let i = 0; i < cn; i++)
        prims.push(r(w / 2 - chW + 4, cy0 + i * cch + 2, chW - 8, cch - 4, 5));
      // corner seat cushion
      prims.push(r(w / 2 - chW + 4, -h / 2 + topH * 0.42, chW - 8, topH * 0.54, 5));
      return prims;
    },
  },
  {
    kind: "coffee-table",
    label: "Coffee table",
    category: "Living",
    w: 110,
    h: 60,
    draw: (w, h) => [body(w, h, 6), r(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 4)],
  },
  {
    kind: "tv-stand",
    label: "TV stand",
    category: "Living",
    w: 150,
    h: 40,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 2)];
      // two cabinet compartment divisions
      for (const x of [-w / 6, w / 6]) prims.push(ln(x, -h / 2, x, h / 2));
      return prims;
    },
  },
  {
    kind: "bookshelf",
    label: "Bookshelf",
    category: "Living",
    w: 100,
    h: 30,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      // book spines (irregular)
      const offs = [0.08, 0.16, 0.21, 0.3, 0.38, 0.43, 0.52, 0.6, 0.68, 0.74, 0.82, 0.9];
      for (const o of offs) {
        const x = -w / 2 + w * o;
        prims.push(ln(x, -h / 2, x, h / 2));
      }
      return prims;
    },
  },
  {
    kind: "rug",
    label: "Rug",
    category: "Living",
    w: 200,
    h: 140,
    draw: (w, h) => {
      const prims: Prim[] = [r(-w / 2, -h / 2, w, h, 4, WHITE)];
      // inner border
      prims.push(r(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 2));
      // wavy field lines
      const inTop = -h / 2 + 16;
      const inBot = h / 2 - 16;
      const rows = 5;
      for (let j = 1; j < rows; j++) {
        const y = inTop + ((inBot - inTop) / rows) * j;
        let d = `M ${n1(-w / 2 + 16)} ${n1(y)}`;
        const segs = 6;
        for (let s = 1; s <= segs; s++) {
          const x = -w / 2 + 16 + ((w - 32) / segs) * s;
          const cx = x - (w - 32) / segs / 2;
          const cy = y + (s % 2 === 0 ? 5 : -5);
          d += ` Q ${n1(cx)} ${n1(cy)} ${n1(x)} ${n1(y)}`;
        }
        prims.push(pth(d));
      }
      // fringe ticks at both ends
      for (let i = 1; i < 14; i++) {
        const x = -w / 2 + (w / 14) * i;
        prims.push(ln(x, -h / 2, x, -h / 2 - 5));
        prims.push(ln(x, h / 2, x, h / 2 + 5));
      }
      return prims;
    },
  },
  {
    kind: "piano",
    label: "Grand piano",
    category: "Living",
    w: 150,
    h: 170,
    draw: (w, h) => {
      const prims: Prim[] = [];
      const kbH = h * 0.12;
      const kbW = w * 0.92;
      const bodyBot = h / 2 - kbH;
      // grand piano body outline (straight keyboard edge, curved bout)
      prims.push(
        pth(
          `M ${n1(-w / 2)} ${n1(bodyBot)}` +
            ` L ${n1(-w / 2)} ${n1(-h / 2 + 14)}` +
            ` Q ${n1(-w / 2)} ${n1(-h / 2)} ${n1(-w / 2 + 14)} ${n1(-h / 2)}` +
            ` L ${n1(w / 2 - 24)} ${n1(-h / 2)}` +
            ` Q ${n1(w / 2)} ${n1(-h / 2)} ${n1(w / 2)} ${n1(-h / 2 + h * 0.34)}` +
            ` Q ${n1(w / 2)} ${n1(bodyBot)} ${n1(w / 2 - w * 0.34)} ${n1(bodyBot)}` +
            ` Z`,
          WHITE,
        ),
      );
      // inner lid line
      prims.push(
        pth(
          `M ${n1(-w / 2 + 8)} ${n1(bodyBot - 6)} L ${n1(-w / 2 + 8)} ${n1(-h / 2 + 14)} Q ${n1(-w / 2 + 8)} ${n1(-h / 2 + 8)} ${n1(-w / 2 + 16)} ${n1(-h / 2 + 8)}`,
        ),
      );
      // keyboard
      prims.push(r(-kbW / 2, h / 2 - kbH, kbW, kbH, 0, WHITE));
      const keys = 22;
      for (let i = 1; i < keys; i++) {
        const x = -kbW / 2 + (kbW / keys) * i;
        prims.push(r(x - 1, h / 2 - kbH, 2, kbH * 0.62, 0, BLACK));
      }
      return prims;
    },
  },

  // ---- Dining ----
  {
    kind: "dining-table",
    label: "Dining set",
    category: "Dining",
    w: 200,
    h: 120,
    draw: (w, h) => {
      const prims: Prim[] = [];
      const tw = w * 0.6;
      const th = h * 0.5;
      prims.push(r(-tw / 2, -th / 2, tw, th, 4, WHITE));
      const cw = w * 0.13;
      const ch = h * 0.16;
      const chair = (cx: number, cy: number, ww: number, hh: number) =>
        r(cx - ww / 2, cy - hh / 2, ww, hh, 4);
      // three chairs top & bottom
      for (const sx of [-1, 0, 1]) {
        prims.push(chair(sx * tw * 0.34, -th / 2 - ch * 0.62, cw, ch));
        prims.push(chair(sx * tw * 0.34, th / 2 + ch * 0.62, cw, ch));
      }
      // end chairs
      prims.push(chair(-tw / 2 - cw * 0.62, 0, ch, cw));
      prims.push(chair(tw / 2 + cw * 0.62, 0, ch, cw));
      return prims;
    },
  },
  {
    kind: "round-table",
    label: "Round set",
    category: "Dining",
    w: 140,
    h: 140,
    draw: (w, h) => {
      const R = Math.min(w, h) / 2;
      const prims: Prim[] = [ci(0, 0, R * 0.56, WHITE)];
      const cw = R * 0.5;
      const ch = R * 0.34;
      // four chairs N/E/S/W
      prims.push(r(-cw / 2, -R, cw, ch, 3)); // top
      prims.push(r(-cw / 2, R - ch, cw, ch, 3)); // bottom
      prims.push(r(-R, -cw / 2, ch, cw, 3)); // left
      prims.push(r(R - ch, -cw / 2, ch, cw, 3)); // right
      return prims;
    },
  },
  {
    kind: "chair",
    label: "Chair",
    category: "Dining",
    w: 45,
    h: 45,
    draw: (w, h) => [
      // seat
      r(-w / 2 + 2, -h / 2 + h * 0.22, w - 4, h * 0.62, 3),
      // backrest
      r(-w / 2 + 2, -h / 2, w - 4, h * 0.16, 2),
      // armrest hints
      ln(-w / 2 + 2, -h / 2 + h * 0.22, -w / 2 + 2, h / 2 - h * 0.16),
      ln(w / 2 - 2, -h / 2 + h * 0.22, w / 2 - 2, h / 2 - h * 0.16),
    ],
  },
  {
    kind: "stool",
    label: "Stool",
    category: "Dining",
    w: 40,
    h: 40,
    draw: (w, h) => [ci(0, 0, Math.min(w, h) / 2, WHITE), ci(0, 0, Math.min(w, h) * 0.32)],
  },

  // ---- Kitchen ----
  {
    kind: "kitchen-line",
    label: "Kitchen (line)",
    category: "Kitchen",
    w: 330,
    h: 60,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      prims.push(r(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 0));
      prims.push(...vDivs(-w / 2, w / 2, -h / 2, h / 2, 55));
      // run left→right: fridge, sink, cooktop
      prims.push(...fridgeBox(-w / 2 + h * 0.55, 0, h * 0.78));
      prims.push(...ksink(-w * 0.08, 0, w * 0.16, h * 0.62, true));
      prims.push(...cooktop(w * 0.28, 0, h * 0.72));
      return prims;
    },
  },
  {
    kind: "kitchen-l",
    label: "Kitchen (L-shape)",
    category: "Kitchen",
    w: 300,
    h: 260,
    draw: (w, h) => {
      const D = 60;
      const x0 = -w / 2;
      const y0 = -h / 2;
      const x1 = w / 2;
      const y1 = h / 2;
      const prims: Prim[] = [];
      // L footprint
      prims.push(
        pth(
          `M ${n1(x0)} ${n1(y0)} L ${n1(x1)} ${n1(y0)} L ${n1(x1)} ${n1(y0 + D)} L ${n1(x0 + D)} ${n1(y0 + D)} L ${n1(x0 + D)} ${n1(y1)} L ${n1(x0)} ${n1(y1)} Z`,
          WHITE,
        ),
      );
      const t = 3;
      // counter lip (inset L)
      prims.push(
        pth(
          `M ${n1(x0 + t)} ${n1(y0 + t)} L ${n1(x1 - t)} ${n1(y0 + t)} L ${n1(x1 - t)} ${n1(y0 + D - t)} L ${n1(x0 + D - t)} ${n1(y0 + D - t)} L ${n1(x0 + D - t)} ${n1(y1 - t)} L ${n1(x0 + t)} ${n1(y1 - t)} Z`,
        ),
      );
      prims.push(...vDivs(x0 + D, x1, y0, y0 + D, 55));
      prims.push(...hDivs(y0 + D, y1, x0, x0 + D, 55));
      // sink + fridge in the top run, cooktop in the leg
      prims.push(...ksink((x0 + D + x1) / 2 - w * 0.05, y0 + D / 2, w * 0.13, D * 0.62, true));
      prims.push(...fridgeBox(x1 - D / 2, y0 + D / 2, D * 0.78));
      prims.push(...cooktop(x0 + D / 2, (y0 + D + y1) / 2, D * 0.72));
      return prims;
    },
  },
  {
    kind: "kitchen-u",
    label: "Kitchen (U-shape)",
    category: "Kitchen",
    w: 300,
    h: 240,
    draw: (w, h) => {
      const D = 60;
      const x0 = -w / 2;
      const y0 = -h / 2;
      const x1 = w / 2;
      const y1 = h / 2;
      const prims: Prim[] = [];
      // U footprint (open at bottom)
      prims.push(
        pth(
          `M ${n1(x0)} ${n1(y0)} L ${n1(x1)} ${n1(y0)} L ${n1(x1)} ${n1(y1)} L ${n1(x1 - D)} ${n1(y1)} L ${n1(x1 - D)} ${n1(y0 + D)} L ${n1(x0 + D)} ${n1(y0 + D)} L ${n1(x0 + D)} ${n1(y1)} L ${n1(x0)} ${n1(y1)} Z`,
          WHITE,
        ),
      );
      const t = 3;
      // counter lip (inset U)
      prims.push(
        pth(
          `M ${n1(x0 + t)} ${n1(y0 + t)} L ${n1(x1 - t)} ${n1(y0 + t)} L ${n1(x1 - t)} ${n1(y1 - t)} L ${n1(x1 - D + t)} ${n1(y1 - t)} L ${n1(x1 - D + t)} ${n1(y0 + D - t)} L ${n1(x0 + D - t)} ${n1(y0 + D - t)} L ${n1(x0 + D - t)} ${n1(y1 - t)} L ${n1(x0 + t)} ${n1(y1 - t)} Z`,
        ),
      );
      prims.push(...vDivs(x0 + D, x1 - D, y0, y0 + D, 55));
      prims.push(...hDivs(y0 + D, y1, x0, x0 + D, 55));
      prims.push(...hDivs(y0 + D, y1, x1 - D, x1, 55));
      // sink center-top, cooktop left leg, fridge right leg
      prims.push(...ksink(0, y0 + D / 2, w * 0.14, D * 0.62, true));
      prims.push(...cooktop(x0 + D / 2, (y0 + D + y1) / 2, D * 0.72));
      prims.push(...fridgeBox(x1 - D / 2, y0 + D + D / 2, D * 0.78));
      return prims;
    },
  },
  {
    kind: "kitchen-galley",
    label: "Kitchen (galley)",
    category: "Kitchen",
    w: 300,
    h: 240,
    draw: (w, h) => {
      const D = 60;
      const x0 = -w / 2;
      const x1 = w / 2;
      const y0 = -h / 2;
      const y1 = h / 2;
      const prims: Prim[] = [];
      // top run
      prims.push(r(x0, y0, w, D, 0, WHITE));
      prims.push(r(x0 + 3, y0 + 3, w - 6, D - 6, 0));
      prims.push(...vDivs(x0, x1, y0, y0 + D, 55));
      // bottom run
      prims.push(r(x0, y1 - D, w, D, 0, WHITE));
      prims.push(r(x0 + 3, y1 - D + 3, w - 6, D - 6, 0));
      prims.push(...vDivs(x0, x1, y1 - D, y1, 55));
      // sink + fridge top, cooktop bottom
      prims.push(...ksink(-w * 0.12, y0 + D / 2, w * 0.16, D * 0.62, true));
      prims.push(...fridgeBox(x1 - D / 2, y0 + D / 2, D * 0.78));
      prims.push(...cooktop(0, y1 - D / 2, D * 0.72));
      return prims;
    },
  },
  {
    kind: "counter",
    label: "Counter",
    category: "Kitchen",
    w: 120,
    h: 60,
    draw: (w, h) => [body(w, h), r(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6)],
  },
  {
    kind: "kitchen-island",
    label: "Island",
    category: "Kitchen",
    w: 180,
    h: 90,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 2), r(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 1)];
      // stools along the front edge
      for (const sx of [-0.3, 0, 0.3]) prims.push(ci(sx * w, h / 2 + 1, Math.min(w, h) * 0.09));
      return prims;
    },
  },
  {
    kind: "sink",
    label: "Sink",
    category: "Kitchen",
    w: 70,
    h: 50,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      // double basin
      prims.push(r(-w / 2 + 6, -h / 2 + 12, w / 2 - 9, h - 20, 3));
      prims.push(r(3, -h / 2 + 12, w / 2 - 9, h - 20, 3));
      // drains
      prims.push(ci(-w / 4, h * 0.05, 2));
      prims.push(ci(w / 4, h * 0.05, 2));
      // faucet
      prims.push(ci(0, -h / 2 + 6, 2.5));
      prims.push(
        pth(
          `M 0 ${n1(-h / 2 + 6)} Q ${n1(w * 0.12)} ${n1(-h / 2 + 6)} ${n1(w * 0.1)} ${n1(-h / 2 + 14)}`,
        ),
      );
      return prims;
    },
  },
  {
    kind: "stove",
    label: "Stove",
    category: "Kitchen",
    w: 60,
    h: 60,
    draw: (w, h) => {
      const m = Math.min(w, h);
      const burnerAt = (cx: number, cy: number): Prim[] => [
        ci(cx, cy, m * 0.14),
        ci(cx, cy, m * 0.08),
        ci(cx, cy, m * 0.025),
      ];
      const prims: Prim[] = [body(w, h)];
      prims.push(...burnerAt(-w / 4, -h / 4 + 3));
      prims.push(...burnerAt(w / 4, -h / 4 + 3));
      prims.push(...burnerAt(-w / 4, h / 4 + 1));
      prims.push(...burnerAt(w / 4, h / 4 + 1));
      return prims;
    },
  },
  {
    kind: "fridge",
    label: "Fridge",
    category: "Kitchen",
    w: 70,
    h: 70,
    draw: (w, h) => [
      body(w, h, 3),
      r(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 2),
      // door front seam (flat top view)
      ln(-w / 2 + 4, h / 2 - 10, w / 2 - 4, h / 2 - 10),
    ],
  },
  {
    kind: "dishwasher",
    label: "Dishwasher",
    category: "Kitchen",
    w: 60,
    h: 60,
    draw: (w, h) => [
      body(w, h),
      r(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 2),
      // door front seam (flat top view)
      ln(-w / 2 + 5, h / 2 - 10, w / 2 - 5, h / 2 - 10),
    ],
  },
  {
    kind: "oven",
    label: "Oven",
    category: "Kitchen",
    w: 60,
    h: 60,
    draw: (w, h) => [
      body(w, h),
      r(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 2),
      // inner oven cavity + door front seam (flat top view)
      r(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 2),
      ln(-w / 2 + 5, h / 2 - 10, w / 2 - 5, h / 2 - 10),
    ],
  },

  // ---- Bathroom ----
  {
    kind: "toilet",
    label: "Toilet",
    category: "Bathroom",
    w: 40,
    h: 70,
    draw: (w, h) => [
      // tank at the back (top)
      r(-w / 2, -h / 2, w, h * 0.24, 2),
      // seat hinge line
      ln(-w / 4, -h / 2 + h * 0.24, w / 4, -h / 2 + h * 0.24),
      // bowl
      el(0, h * 0.14, w / 2, h * 0.33, WHITE),
      el(0, h * 0.14, w * 0.32, h * 0.24),
    ],
  },
  {
    kind: "bathroom-sink",
    label: "Bathroom sink",
    category: "Bathroom",
    w: 55,
    h: 45,
    draw: (w, h) => [
      body(w, h, 3),
      el(0, h * 0.06, w * 0.36, h * 0.32),
      // faucet
      ci(0, -h / 2 + 6, 2.5),
      ln(0, -h / 2 + 6, 0, -h / 2 + 12),
    ],
  },
  {
    kind: "bathtub",
    label: "Bathtub",
    category: "Bathroom",
    w: 170,
    h: 75,
    draw: (w, h) => [
      body(w, h, 10),
      // inner basin (organic oval)
      el(w * 0.04, 0, w / 2 - 16, h / 2 - 10, WHITE),
      // drain
      ci(-w / 2 + 22, 0, 2.5),
      // taps
      ci(-w / 2 + 9, -h * 0.18, 2),
      ci(-w / 2 + 9, h * 0.18, 2),
    ],
  },
  {
    kind: "shower",
    label: "Shower",
    category: "Bathroom",
    w: 90,
    h: 90,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      // tile grid
      for (let i = 1; i < 4; i++) {
        prims.push(ln(-w / 2 + (w / 4) * i, -h / 2, -w / 2 + (w / 4) * i, h / 2));
        prims.push(ln(-w / 2, -h / 2 + (h / 4) * i, w / 2, -h / 2 + (h / 4) * i));
      }
      // central drain
      prims.push(ci(0, 0, Math.min(w, h) * 0.1));
      prims.push(ci(0, 0, Math.min(w, h) * 0.035));
      return prims;
    },
  },
  {
    kind: "washer",
    label: "Washer",
    category: "Bathroom",
    w: 60,
    h: 60,
    draw: (w, h) => [
      body(w, h),
      // top-loader lid (flat top view)
      ci(0, 0, Math.min(w, h) * 0.34),
      ci(0, 0, Math.min(w, h) * 0.24),
    ],
  },

  // ---- Office ----
  {
    kind: "desk",
    label: "Desk",
    category: "Office",
    w: 140,
    h: 70,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      // drawer pedestal outline on the right (flat top view)
      prims.push(ln(w / 4, -h / 2, w / 4, h / 2));
      // monitor + keyboard hints (objects seen from above)
      prims.push(r(-w / 3, -h / 2 + 5, w * 0.28, h * 0.12, 1));
      prims.push(r(-w / 3, -h / 2 + h * 0.4, w * 0.34, h * 0.18, 1));
      return prims;
    },
  },
  {
    kind: "office-chair",
    label: "Office chair",
    category: "Office",
    w: 55,
    h: 55,
    draw: (w, h) => [
      // seat
      r(-w * 0.3, -h * 0.06, w * 0.6, h * 0.5, 4),
      // backrest
      r(-w * 0.34, -h / 2, w * 0.68, h * 0.16, 4),
      // armrests
      ln(-w * 0.36, -h * 0.06, -w * 0.36, h * 0.3),
      ln(w * 0.36, -h * 0.06, w * 0.36, h * 0.3),
    ],
  },
  {
    kind: "bookcase",
    label: "Bookcase",
    category: "Office",
    w: 90,
    h: 35,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      const offs = [0.1, 0.18, 0.24, 0.34, 0.42, 0.5, 0.58, 0.66, 0.74, 0.82, 0.9];
      for (const o of offs) {
        const x = -w / 2 + w * o;
        prims.push(ln(x, -h / 2, x, h / 2));
      }
      return prims;
    },
  },

  // ---- Misc ----
  {
    kind: "floor-lamp",
    label: "Floor lamp",
    category: "Misc",
    w: 40,
    h: 40,
    draw: (w, h) => [
      ci(0, 0, Math.min(w, h) / 2),
      ci(0, 0, Math.min(w, h) * 0.32),
      ci(0, 0, Math.min(w, h) * 0.08),
    ],
  },
  {
    kind: "table-lamp",
    label: "Table lamp",
    category: "Misc",
    w: 28,
    h: 28,
    draw: (w, h) => [
      ci(0, 0, Math.min(w, h) / 2),
      ci(0, 0, Math.min(w, h) * 0.18),
      ci(0, 0, Math.min(w, h) * 0.06),
    ],
  },
  {
    kind: "plant",
    label: "Plant",
    category: "Misc",
    w: 45,
    h: 45,
    draw: (w, h) => {
      const R = Math.min(w, h) / 2;
      // solid black feathery foliage
      return [burst(0, 0, R, 13, 0.42, BLACK), ci(0, 0, R * 0.12, WHITE)];
    },
  },
  {
    kind: "potted-plant",
    label: "Potted plant",
    category: "Misc",
    w: 50,
    h: 50,
    draw: (w, h) => {
      const R = Math.min(w, h) / 2;
      const prims: Prim[] = [];
      // pot (trapezoid)
      prims.push(
        pth(
          `M ${n1(-R * 0.42)} ${n1(R * 0.2)} L ${n1(R * 0.42)} ${n1(R * 0.2)} L ${n1(R * 0.32)} ${n1(R)} L ${n1(-R * 0.32)} ${n1(R)} Z`,
          WHITE,
        ),
      );
      // solid black leafy clump above the pot
      const ring = 7;
      for (let i = 0; i < ring; i++) {
        const a = (i / ring) * Math.PI * 2;
        prims.push(ci(Math.cos(a) * R * 0.42, -R * 0.18 + Math.sin(a) * R * 0.42, R * 0.3, BLACK));
      }
      prims.push(ci(0, -R * 0.18, R * 0.42, BLACK));
      return prims;
    },
  },
  {
    kind: "stairs",
    label: "Stairs",
    category: "Misc",
    w: 100,
    h: 220,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h)];
      const steps = 12;
      for (let i = 1; i < steps; i++) {
        const y = -h / 2 + (h / steps) * i;
        prims.push(ln(-w / 2, y, w / 2, y));
      }
      // handrail line
      prims.push(ln(w * 0.32, -h / 2, w * 0.32, h / 2));
      // direction arrow (up)
      prims.push(ln(-w * 0.12, h / 2 - 12, -w * 0.12, -h / 2 + 14));
      prims.push(ln(-w * 0.12, -h / 2 + 14, -w * 0.24, -h / 2 + 14 + h * 0.05));
      prims.push(ln(-w * 0.12, -h / 2 + 14, 0, -h / 2 + 14 + h * 0.05));
      return prims;
    },
  },
  {
    kind: "spiral-stairs",
    label: "Spiral stairs",
    category: "Misc",
    w: 140,
    h: 140,
    draw: (w, h) => {
      const R = Math.min(w, h) / 2;
      const prims: Prim[] = [ci(0, 0, R)];
      const steps = 12;
      for (let i = 0; i < steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        prims.push(ln(0, 0, Math.cos(a) * R, Math.sin(a) * R));
      }
      // centre post
      prims.push(ci(0, 0, R * 0.14));
      return prims;
    },
  },
  {
    kind: "door-mat",
    label: "Mat",
    category: "Misc",
    w: 80,
    h: 50,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 3), r(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 2)];
      // texture lines
      for (let i = 1; i < 4; i++) {
        const y = -h / 2 + 6 + ((h - 12) / 4) * i;
        prims.push(ln(-w / 2 + 6, y, w / 2 - 6, y));
      }
      return prims;
    },
  },

  // ---- Outdoor ----
  {
    kind: "car",
    label: "Car",
    category: "Outdoor",
    w: 180,
    h: 430,
    draw: (w, h) => {
      const prims: Prim[] = [r(-w / 2, -h / 2, w, h, 30, WHITE)];
      const roofY = -h * 0.08;
      const roofH = h * 0.42;
      // cabin / roof
      prims.push(r(-w / 2 + 10, roofY, w - 20, roofH, 16));
      // windshield (front, toward top)
      prims.push(ln(-w / 2 + 10, roofY, -w / 2 + 26, roofY - h * 0.1));
      prims.push(ln(w / 2 - 10, roofY, w / 2 - 26, roofY - h * 0.1));
      prims.push(ln(-w / 2 + 26, roofY - h * 0.1, w / 2 - 26, roofY - h * 0.1));
      // rear window (toward bottom)
      prims.push(ln(-w / 2 + 10, roofY + roofH, -w / 2 + 26, roofY + roofH + h * 0.08));
      prims.push(ln(w / 2 - 10, roofY + roofH, w / 2 - 26, roofY + roofH + h * 0.08));
      prims.push(ln(-w / 2 + 26, roofY + roofH + h * 0.08, w / 2 - 26, roofY + roofH + h * 0.08));
      // roof centre line
      prims.push(ln(0, roofY + 8, 0, roofY + roofH - 8));
      // headlights (front)
      prims.push(r(-w / 2 + 12, -h / 2 + 6, w * 0.2, 7, 2));
      prims.push(r(w / 2 - 12 - w * 0.2, -h / 2 + 6, w * 0.2, 7, 2));
      // taillights (rear)
      prims.push(r(-w / 2 + 12, h / 2 - 13, w * 0.2, 7, 2));
      prims.push(r(w / 2 - 12 - w * 0.2, h / 2 - 13, w * 0.2, 7, 2));
      // wheels
      const ww = 12;
      const wl = h * 0.14;
      prims.push(r(-w / 2 + 2, -h / 2 + h * 0.15, ww, wl, 3));
      prims.push(r(w / 2 - 2 - ww, -h / 2 + h * 0.15, ww, wl, 3));
      prims.push(r(-w / 2 + 2, h / 2 - h * 0.15 - wl, ww, wl, 3));
      prims.push(r(w / 2 - 2 - ww, h / 2 - h * 0.15 - wl, ww, wl, 3));
      return prims;
    },
  },
  {
    kind: "tree",
    label: "Tree",
    category: "Outdoor",
    w: 150,
    h: 150,
    draw: (w, h) => {
      const R = Math.min(w, h) / 2;
      const prims: Prim[] = [ci(0, 0, R), ci(0, 0, R * 0.72)];
      // radial ticks between the two rings (sun-like canopy)
      const ticks = 28;
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2;
        prims.push(
          ln(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72, Math.cos(a) * R, Math.sin(a) * R),
        );
      }
      // trunk
      prims.push(ci(0, 0, R * 0.1));
      return prims;
    },
  },
  {
    kind: "bush",
    label: "Bush",
    category: "Outdoor",
    w: 70,
    h: 70,
    draw: (w, h) => {
      const R = Math.min(w, h) / 2;
      const prims: Prim[] = [];
      // solid black leafy clump (bumpy ring + central mass)
      const bumps = 9;
      for (let i = 0; i < bumps; i++) {
        const a = (i / bumps) * Math.PI * 2;
        prims.push(ci(Math.cos(a) * R * 0.64, Math.sin(a) * R * 0.64, R * 0.34, BLACK));
      }
      prims.push(ci(0, 0, R * 0.55, BLACK));
      return prims;
    },
  },
  {
    kind: "hedge",
    label: "Hedge",
    category: "Outdoor",
    w: 160,
    h: 35,
    draw: (w, h) => {
      const prims: Prim[] = [body(w, h, 3)];
      // dense vertical foliage strokes of varying height
      const strokes = Math.max(18, Math.round(w / 8));
      for (let i = 1; i < strokes; i++) {
        const x = -w / 2 + (w / strokes) * i;
        const inset = h * (0.12 + 0.12 * Math.abs(Math.sin(i * 1.7)));
        prims.push(ln(x, -h / 2 + inset, x, h / 2 - inset));
      }
      return prims;
    },
  },
];

const BY_KIND = new Map(FURNITURE.map((f) => [f.kind, f]));

export function furnitureDef(kind: string): FurnitureDef | undefined {
  return BY_KIND.get(kind);
}

export function furnitureSymbol(kind: string, w: number, h: number): Prim[] {
  const def = BY_KIND.get(kind);
  if (!def) return [r(-w / 2, -h / 2, w, h, 0, WHITE)];
  return def.draw(w, h);
}

export const FURNITURE_CATEGORIES: { name: string; items: FurnitureDef[] }[] =
  (() => {
    const order: string[] = [];
    const map = new Map<string, FurnitureDef[]>();
    for (const f of FURNITURE) {
      if (!map.has(f.category)) {
        map.set(f.category, []);
        order.push(f.category);
      }
      map.get(f.category)!.push(f);
    }
    return order.map((name) => ({ name, items: map.get(name)! }));
  })();

// Serialise a primitive to an SVG string fragment (used by exporters).
export function primToSvgString(
  p: Prim,
  stroke: string,
  strokeWidth: number,
  fillOverride?: string,
): string {
  const sw = `stroke="${stroke}" stroke-width="${strokeWidth}"`;
  const fillFor = (fill: string | undefined) => {
    const normalized = fill?.toLowerCase();
    const white =
      normalized === "#fff" ||
      normalized === "#ffffff" ||
      normalized === "white";
    return white && fillOverride ? fillOverride : (fill ?? "none");
  };
  switch (p.t) {
    case "rect":
      return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"${
        p.rx ? ` rx="${p.rx}"` : ""
      } fill="${fillFor(p.fill)}" ${sw}/>`;
    case "line":
      return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" ${sw}/>`;
    case "circle":
      return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${
        fillFor(p.fill)
      }" ${sw}/>`;
    case "ellipse":
      return `<ellipse cx="${p.cx}" cy="${p.cy}" rx="${p.rx}" ry="${p.ry}" fill="${
        fillFor(p.fill)
      }" ${sw}/>`;
    case "path":
      return `<path d="${p.d}" fill="${fillFor(p.fill)}" ${sw}/>`;
    case "polyline": {
      const pts: string[] = [];
      for (let i = 0; i < p.pts.length; i += 2) {
        pts.push(`${p.pts[i]},${p.pts[i + 1]}`);
      }
      return `<polyline points="${pts.join(" ")}" fill="none" ${sw}/>`;
    }
  }
}
