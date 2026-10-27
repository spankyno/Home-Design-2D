#!/usr/bin/env python3
"""Genera og-image.png (1200x630) e iconos de la app.

Uso:  python3 scripts/generate-brand-assets.py
Requiere: Pillow.  Salida: artifacts/floorplan/public/
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "artifacts/floorplan/public"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans{}.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono{}.ttf"

INK = (20, 34, 56)
INK_SOFT = (36, 52, 74)
PAPER = (244, 241, 233)
PAPER_DEEP = (233, 228, 217)
GOLD = (198, 164, 94)
GOLD_LIGHT = (222, 199, 142)
MUTED = (168, 178, 192)

S = 2  # supersampling factor
W, H = 1200, 630


def font(path, size):
    return ImageFont.truetype(path, int(size * S))


def og_image():
    im = Image.new("RGB", (W * S, H * S), INK)
    d = ImageDraw.Draw(im, "RGBA")
    px = lambda v: int(v * S)

    # faint blueprint grid
    for x in range(0, W + 1, 40):
        d.line([(px(x), 0), (px(x), px(H))], fill=(255, 255, 255, 9), width=S)
    for y in range(0, H + 1, 40):
        d.line([(0, px(y)), (px(W), px(y))], fill=(255, 255, 255, 9), width=S)

    # gold frame
    d.rectangle([px(24), px(24), px(W - 24), px(H - 24)], outline=GOLD + (120,), width=S)

    # ---- left column (kept inside social-crop safe zone) ----
    d.line([(px(72), px(118)), (px(116), px(118))], fill=GOLD, width=2 * S)
    d.text((px(128), px(106)), "EDITOR DE PLANOS 2D · ONLINE", font=font(MONO.format("-Bold"), 19), fill=GOLD_LIGHT)

    d.text((px(72), px(156)), "Home", font=font(FONT.format("-Bold"), 88), fill=(255, 255, 255))
    d.text((px(72), px(246)), "Design 2D", font=font(FONT.format("-Bold"), 88), fill=GOLD_LIGHT)

    sub = font(FONT.format(""), 29)
    d.text((px(72), px(372)), "Dibuja, mide y exporta planos", font=sub, fill=PAPER)
    d.text((px(72), px(412)), "directamente en tu navegador.", font=sub, fill=PAPER)

    chip = font(MONO.format("-Bold"), 18)
    x = 72
    for label in ("PNG", "PDF", "JSON"):
        w = d.textlength(label, font=chip) / S
        d.rounded_rectangle([px(x), px(470), px(x + w + 28), px(506)], radius=px(4), outline=GOLD, width=S)
        d.text((px(x + 14), px(478)), label, font=chip, fill=GOLD_LIGHT)
        x += w + 28 + 12

    d.text((px(72), px(560)), "home-design-2d.pages.dev", font=font(MONO.format(""), 20), fill=MUTED)

    # ---- right: paper card with floor plan ----
    cx0, cy0, cx1, cy1 = 690, 64, 1140, 566
    d.rounded_rectangle([px(cx0), px(cy0), px(cx1), px(cy1)], radius=px(6), fill=PAPER)
    d.text((px(cx0 + 24), px(cy0 + 18)), "PLANTA / PROPUESTA A", font=font(MONO.format(""), 14), fill=(111, 119, 125))
    d.text((px(cx0 + 24), px(cy1 - 34)), "PLANTA DE DISTRIBUCIÓN · ESC. 1:50", font=font(MONO.format(""), 14), fill=(111, 119, 125))

    s = 1.2
    ox, oy = cx0 + 36, cy0 + 96  # plan origin (SVG x=91,y=57)

    def P(x, y):
        return (px(ox + (x - 91) * s), px(oy + (y - 57) * s))

    def line(pts, color=INK, w=2.0):
        d.line([P(*p) for p in pts], fill=color, width=max(1, int(w * S)), joint="curve")

    # room tints
    for (x0, y0, x1, y1) in [(112, 78, 291, 181), (112, 181, 226, 310), (226, 231, 394, 310), (291, 78, 394, 231)]:
        d.rectangle([*P(x0, y0), *P(x1, y1)], fill=PAPER_DEEP)

    # walls
    wall = 6
    line([(91, 57), (415, 57), (415, 331), (91, 331), (91, 57)], INK, wall)
    for seg in [[(291, 57), (291, 250)], [(291, 286), (291, 331)], [(91, 181), (312, 181)],
                [(224, 181), (224, 331)], [(224, 249), (415, 249)]]:
        line(seg, INK, wall - 1)
    # door openings (cut walls with paper), then swing arcs
    for seg in [[(291, 124), (291, 159)], [(291, 250), (291, 286)], [(144, 181), (180, 181)],
                [(224, 249), (259, 249)], [(415, 157), (415, 190)]]:
        line(seg, PAPER, wall + 1)
    for (hx, hy, r, a0, a1) in [(291, 159, 35, 270, 360), (144, 217, 36, 270, 360),
                                (224, 284, 35, 270, 360), (382, 157, 33, 0, 90)]:
        bx0, by0 = P(hx - r, hy - r)
        bx1, by1 = P(hx + r, hy + r)
        d.arc([bx0, by0, bx1, by1], a0, a1, fill=GOLD, width=int(1.6 * S))
    # windows
    for seg in [[(155, 57), (173, 57)], [(351, 57), (369, 57)], [(91, 267), (91, 284)]]:
        line(seg, GOLD, 4)

    # furniture
    for (x0, y0, x1, y1) in [(137, 94, 209, 137), (130, 226, 183, 274), (316, 91, 367, 117), (284, 267, 331, 293)]:
        d.rounded_rectangle([*P(x0, y0), *P(x1, y1)], radius=px(2), outline=INK, width=int(1.4 * S))
    line([(145, 115), (201, 115)], INK, 1.2)
    line([(173, 102), (173, 129)], INK, 1.2)
    line([(137, 250), (176, 250)], INK, 1.2)

    # dimension line
    line([(91, 39), (415, 39)], GOLD, 1.4)
    line([(91, 33), (91, 45)], GOLD, 1.4)
    line([(415, 33), (415, 45)], GOLD, 1.4)
    dim = font(MONO.format("-Bold"), 15)
    tx, ty = P(253, 22)
    d.text((tx, ty), "8,40 m", font=dim, fill=(111, 100, 60), anchor="mm")

    im = im.resize((W, H), Image.LANCZOS)
    im.save(OUT / "og-image.png", optimize=True)


def icons():
    def draw(size):
        k = 8
        im = Image.new("RGBA", (size * k, size * k), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.rounded_rectangle([0, 0, size * k - 1, size * k - 1], radius=int(size * k * 0.22), fill=INK)
        u = size * k / 180
        for inset, w in ((38, 7), (62, 7), (86, 7)):
            d.rectangle([inset * u, inset * u, (180 - inset) * u, (180 - inset) * u],
                        outline=GOLD if inset != 62 else GOLD_LIGHT, width=int(w * u * 0.55))
        return im.resize((size, size), Image.LANCZOS)

    draw(180).save(OUT / "apple-touch-icon.png", optimize=True)
    draw(192).save(OUT / "icon-192.png", optimize=True)
    draw(512).save(OUT / "icon-512.png", optimize=True)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    og_image()
    icons()
    print("OK ->", OUT)
