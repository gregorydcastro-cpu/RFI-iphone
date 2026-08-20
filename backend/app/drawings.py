"""Generate demo structural sheets so the iOS canvas has a real drawing."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ):
        path = Path(name)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def _title_block(draw: ImageDraw.ImageDraw, w: int, h: int, sheet: str,
                 title: str, rev: str, discipline: str) -> None:
    box = (w - 420, h - 200, w - 24, h - 24)
    draw.rectangle(box, outline="#1a1a1a", width=3)
    draw.rectangle((box[0], box[1], box[2], box[1] + 36), fill="#1a1a1a")
    draw.text((box[0] + 12, box[1] + 8), "CASTRO CONSTRUCTION  ·  IFC", fill="white",
              font=_font(16))
    draw.text((box[0] + 16, box[1] + 50), sheet, fill="#111", font=_font(42))
    draw.text((box[0] + 16, box[1] + 100), title, fill="#222", font=_font(18))
    draw.text((box[0] + 16, box[1] + 132), f"{discipline}   REV {rev}", fill="#333",
              font=_font(16))
    draw.text((box[0] + 16, box[1] + 158), "Harbor Yard Warehouse", fill="#444",
              font=_font(14))


def _grid(draw: ImageDraw.ImageDraw, origin: tuple[int, int], cols: int, rows: int,
          spacing: int, letters: str) -> None:
    x0, y0 = origin
    for i, letter in enumerate(letters[:cols]):
        x = x0 + i * spacing
        draw.line((x, y0, x, y0 + (rows - 1) * spacing), fill="#4a6fa5", width=2)
        _bubble(draw, x, y0 - 36, letter)
        _bubble(draw, x, y0 + (rows - 1) * spacing + 36, letter)
    for j in range(rows):
        y = y0 + j * spacing
        draw.line((x0, y, x0 + (cols - 1) * spacing, y), fill="#4a6fa5", width=2)
        _bubble(draw, x0 - 36, y, str(j + 1))
        _bubble(draw, x0 + (cols - 1) * spacing + 36, y, str(j + 1))


def _bubble(draw: ImageDraw.ImageDraw, x: int, y: int, text: str) -> None:
    r = 16
    draw.ellipse((x - r, y - r, x + r, y + r), outline="#1a1a1a", width=2, fill="#f4f7fb")
    draw.text((x - 5 * len(text), y - 8), text, fill="#111", font=_font(16))


def _column(draw: ImageDraw.ImageDraw, x: int, y: int) -> None:
    s = 14
    draw.rectangle((x - s, y - s, x + s, y + s), outline="#111", width=3)
    draw.line((x - s, y - s, x + s, y + s), fill="#111", width=2)
    draw.line((x - s, y + s, x + s, y - s), fill="#111", width=2)


def write_s301(path: Path, revision: str) -> None:
    w, h = 1600, 1200
    img = Image.new("RGB", (w, h), "#f3efe4")
    draw = ImageDraw.Draw(img)
    draw.rectangle((16, 16, w - 16, h - 16), outline="#222", width=4)
    draw.text((36, 28), f"FOUNDATION PLAN  ·  S301  ·  REV {revision}", fill="#222",
              font=_font(22))
    draw.text((36, 60), "Do not scale drawing. Dimensions govern.", fill="#555",
              font=_font(14))

    origin = (220, 200)
    spacing = 220
    _grid(draw, origin, 5, 4, spacing, "ABCDE")

    # Footings / grade beams
    for i in range(5):
        for j in range(4):
            x = origin[0] + i * spacing
            y = origin[1] + j * spacing
            _column(draw, x, y)
            if i < 4:
                draw.rectangle(
                    (x + 18, y - 10, x + spacing - 18, y + 10),
                    outline="#5a4632",
                    width=2,
                )

    # Callout near grid B-4 (col 1, row 3)
    bx = origin[0] + 1 * spacing
    by = origin[1] + 3 * spacing
    draw.ellipse((bx + 40, by - 70, bx + 160, by - 20), outline="#b45309", width=3)
    draw.text((bx + 50, by - 58), "BEAM / DUCT", fill="#9a3412", font=_font(14))

    _title_block(draw, w, h, "S301", "FOUNDATION PLAN", revision, "STRUCTURAL")
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def write_s302(path: Path, revision: str) -> None:
    w, h = 1600, 1200
    img = Image.new("RGB", (w, h), "#eef2f6")
    draw = ImageDraw.Draw(img)
    draw.rectangle((16, 16, w - 16, h - 16), outline="#222", width=4)
    draw.text((36, 28), f"FRAMING PLAN  ·  S302  ·  REV {revision}", fill="#222",
              font=_font(22))

    origin = (240, 220)
    spacing = 240
    _grid(draw, origin, 4, 4, spacing, "ABCD")
    for i in range(4):
        for j in range(4):
            _column(draw, origin[0] + i * spacing, origin[1] + j * spacing)
        if i < 3:
            y = origin[1] + spacing
            draw.line(
                (origin[0] + i * spacing, y, origin[0] + (i + 1) * spacing, y),
                fill="#7c2d12",
                width=6,
            )

    _title_block(draw, w, h, "S302", "FRAMING PLAN", revision, "STRUCTURAL")
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")


def ensure_demo_drawings(assets_dir: Path) -> dict[str, Path]:
    files = {
        "s301-rev-b.png": ("S301", "B"),
        "s301-rev-c.png": ("S301", "C"),
        "s302-rev-a.png": ("S302", "A"),
    }
    paths = {}
    for name, (sheet, rev) in files.items():
        dest = assets_dir / name
        if sheet == "S301":
            write_s301(dest, rev)
        else:
            write_s302(dest, rev)
        paths[name] = dest
    return paths
