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
                 title: str, rev: str, discipline: str,
                 banner: str = "CASTRO CONSTRUCTION  ·  IFC",
                 project: str = "Harbor Yard Warehouse") -> None:
    box = (w - 420, h - 200, w - 24, h - 24)
    draw.rectangle(box, outline="#1a1a1a", width=3)
    draw.rectangle((box[0], box[1], box[2], box[1] + 36), fill="#1a1a1a")
    draw.text((box[0] + 12, box[1] + 8), banner, fill="white", font=_font(16))
    draw.text((box[0] + 16, box[1] + 50), sheet, fill="#111", font=_font(42))
    draw.text((box[0] + 16, box[1] + 100), title, fill="#222", font=_font(18))
    draw.text((box[0] + 16, box[1] + 132), f"{discipline}   REV {rev}", fill="#333",
              font=_font(16))
    draw.text((box[0] + 16, box[1] + 158), project, fill="#444", font=_font(14))


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


def write_el107_n(path: Path) -> tuple[int, int]:
    """Full-sheet catalog ingest of Greg's EL107_N Rev 27 / Bulletin 46 print.

    Uses only sheet facts from the attached title block and legend. Does not
    invent another sheet number or an E-803 revision.
    """
    w, h = 3600, 2400
    img = Image.new("RGB", (w, h), "#f7f4ea")
    draw = ImageDraw.Draw(img)
    draw.rectangle((20, 20, w - 20, h - 20), outline="#222", width=5)
    draw.text((40, 36), "ELECTRICAL LIGHTING PLAN — LEVEL 07 NORTH", fill="#111",
              font=_font(28))
    draw.text((40, 76), "EL107_N   ·   REV 27   ·   BULLETIN 46  06/25/2026   ·   IFC 11/01/2024",
              fill="#333", font=_font(18))
    draw.text((40, 108), "Do not scale drawing. Refer to E-803 for vivarium lighting-control details "
              "(revision not stated on this sheet).", fill="#444", font=_font(16))

    # Grid 1–12 across, G–R up the left of the plan area
    origin = (220, 280)
    col_w, row_h = 200, 130
    letters = "GHIJKLMNOPQR"
    for i in range(12):
        x = origin[0] + i * col_w
        draw.line((x, origin[1], x, origin[1] + 11 * row_h), fill="#6b8caf", width=2)
        _bubble(draw, x, origin[1] - 40, str(i + 1) if i < 9 else str(i + 1))
    for j, letter in enumerate(letters):
        y = origin[1] + j * row_h
        draw.line((origin[0], y, origin[0] + 11 * col_w, y), fill="#6b8caf", width=2)
        _bubble(draw, origin[0] - 40, y, letter)

    def hatch(box: tuple[int, int, int, int], label: str) -> None:
        x0, y0, x1, y1 = box
        draw.rectangle(box, outline="#8a5a12", width=3)
        step = 18
        for k in range(- (y1 - y0), x1 - x0, step):
            draw.line((x0 + k, y0, x0 + k + (y1 - y0), y1), fill="#c4a574", width=1)
        draw.rectangle((x0 + 8, y0 + 8, x0 + 8 + 8 * len(label), y0 + 36), fill="#f7f4ea")
        draw.text((x0 + 12, y0 + 12), label, fill="#6b3f08", font=_font(16))

    # Hatched vivarium lighting-control zones from the print (gnotobiotics + isolation).
    # Pin 0.28, 0.52 lands in this hatch on the 3600x2400 sheet.
    hatch((280, 720, 1180, 1680), "GNOTOBIOTICS / ISOLATION CUBICLES")
    draw.text((300, 770), "721 GNOTOBIOTICS SUITE", fill="#222", font=_font(15))
    draw.text((300, 800), "720 BEHAVIORAL  ·  720D IMAGING", fill="#222", font=_font(14))
    draw.text((300, 1540), "740–743 ISOLATION CUBICLES  ·  740A IN-OUT SUITE",
              fill="#222", font=_font(14))
    draw.text((300, 1580), "TOUCH SCREEN PROVIDED BY ETC. CONTROL OF THE LIGHTING",
              fill="#333", font=_font(13))
    draw.text((300, 1604), "SHALL BE PROVIDED AT THIS TOUCHSCREEN (TYPICAL).",
              fill="#333", font=_font(13))

    hatch((1280, 1480, 1880, 1860), "ISOLATION CUBICLES")

    # Rooms outside the hatch — names taken from the print only.
    draw.rectangle((2000, 400, 2480, 700), outline="#333", width=2)
    draw.text((2020, 420), "ANIMAL RESEARCH LAB", fill="#222", font=_font(16))
    draw.rectangle((2000, 740, 2480, 980), outline="#333", width=2)
    draw.text((2020, 760), "CAGE WASH (CLEAN / SOILED)", fill="#222", font=_font(16))
    draw.rectangle((2000, 1020, 2480, 1260), outline="#333", width=2)
    draw.text((2020, 1040), "STERILE STORAGE", fill="#222", font=_font(16))
    draw.rectangle((2520, 400, 2920, 700), outline="#333", width=2)
    draw.text((2540, 420), "OFFICE", fill="#222", font=_font(16))
    draw.rectangle((2520, 740, 2920, 980), outline="#333", width=2)
    draw.text((2540, 760), "CORRIDOR", fill="#222", font=_font(16))

    # Lighting symbols (schematic, not a new drawing number)
    for i in range(6):
        for j in range(4):
            cx = 2060 + i * 70
            cy = 1340 + j * 50
            draw.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), outline="#1d4f72", width=2)

    legend = (2920, 80, 3560, 320)
    draw.rectangle(legend, outline="#222", width=2)
    draw.rectangle((2920, 80, 3560, 118), fill="#222")
    draw.text((2936, 88), "LEGEND", fill="white", font=_font(16))
    draw.rectangle((2940, 140, 3000, 190), outline="#8a5a12", width=2)
    draw.line((2940, 140, 3000, 190), fill="#c4a574", width=1)
    draw.line((2940, 190, 3000, 140), fill="#c4a574", width=1)
    draw.text((3012, 136), "AREA SERVED BY VIVARIUM LIGHTING", fill="#222", font=_font(14))
    draw.text((3012, 158), "CONTROL SYSTEM. REFER TO E-803", fill="#222", font=_font(14))
    draw.text((3012, 180), "FOR ADDITIONAL DETAILS.", fill="#222", font=_font(14))
    draw.text((3012, 210), "E-803 revision is not stated on EL107_N.", fill="#6b3f08",
              font=_font(13))

    _title_block(
        draw, w, h, "EL107_N", "ELECTRICAL LIGHTING PLAN — L07 NORTH",
        "27", "E",
        banner="TENBERKE  ·  BALLINGER  ·  4224",
        project="Brown ILSB  ·  233 Richmond St",
    )
    draw.text((w - 404, h - 48), "BULLETIN 46  ·  06/25/2026  ·  IFC 11/01/2024",
              fill="#333", font=_font(13))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    preview = path.with_name(path.stem + "-preview.png")
    img.resize((w // 3, h // 3)).save(preview, "PNG")
    return w, h


def png_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as img:
        return img.size


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
    el107 = assets_dir / "el107_n-rev-27.png"
    write_el107_n(el107)
    paths["el107_n-rev-27.png"] = el107
    return paths
