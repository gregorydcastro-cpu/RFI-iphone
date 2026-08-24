"""Generate bundled fake E-101 Rev A samples so the iOS canvas has a drawing."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SHEET_E101 = "e-101-rev-a.png"
SHEET_CEDAR_E101 = "cedar-lot-e-101-rev-a.png"
SHEET_MILL_E101 = "mill-street-e-101-rev-a.png"

# Distinct fixture counts so takeoff is sheet-specific, not invented.
SHOP_FIXTURES = [
    (320, 360),
    (640, 360),
    (960, 360),
    (1280, 360),
    (320, 720),
    (640, 720),
    (960, 720),
    (1280, 720),
]
CEDAR_FIXTURES = [
    (400, 400),
    (800, 400),
    (1200, 400),
    (400, 760),
    (800, 760),
    (1200, 760),
]
MILL_FIXTURES = [
    (520, 420),
    (1080, 420),
    (520, 780),
    (1080, 780),
]


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


def write_sample_sheet(
    path: Path,
    *,
    job_name: str,
    centers: list[tuple[int, int]],
) -> tuple[int, int]:
    """Fake lighting plan. Marked SAMPLE / NOT A REAL JOB. Not a live job sheet."""
    w, h = 1800, 1200
    img = Image.new("RGB", (w, h), (237, 234, 224))
    draw = ImageDraw.Draw(img)
    ink = (40, 42, 46)
    muted = (90, 92, 96)
    rule = (160, 158, 150)
    draw.rectangle([24, 24, w - 25, h - 25], outline=ink, width=3)
    draw.rectangle([24, h - 160, w - 25, h - 25], outline=ink, width=2)
    draw.rectangle([w - 420, h - 160, w - 25, h - 25], outline=ink, width=2)
    draw.text((48, 44), "SAMPLE SHEET  —  NOT A REAL JOB", fill=ink, font=_font(36))
    draw.text((48, 96), f"{job_name}    ·    E-101    ·    Rev A", fill=muted, font=_font(22))
    draw.text(
        (48, 136),
        "Generic lighting plan for takeoff practice. Fake fixtures only.",
        fill=muted,
        font=_font(16),
    )
    draw.rectangle([120, 220, 1680, 980], outline=rule, width=2)
    for x in range(120, 1681, 260):
        draw.line([(x, 220), (x, 980)], fill=(210, 208, 198), width=1)
    for y in range(220, 981, 190):
        draw.line([(120, y), (1680, y)], fill=(210, 208, 198), width=1)
    fixture = (0x1D, 0x4F, 0x72)
    radius = 22
    for cx, cy in centers:
        draw.ellipse(
            [cx - radius, cy - radius, cx + radius, cy + radius],
            outline=fixture,
            width=4,
        )
    draw.text((48, h - 130), "SHEET", fill=muted, font=_font(16))
    draw.text((48, h - 100), "E-101", fill=ink, font=_font(36))
    draw.text((280, h - 130), "REV", fill=muted, font=_font(16))
    draw.text((280, h - 100), "A", fill=ink, font=_font(36))
    stamp = job_name.upper()
    draw.text((w - 400, h - 130), stamp[:22], fill=ink, font=_font(22))
    draw.text((w - 400, h - 90), "SAMPLE  ·  NOT A REAL JOB", fill=muted, font=_font(16))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG")
    return w, h


def write_e101(path: Path) -> tuple[int, int]:
    return write_sample_sheet(path, job_name="G-Line Shop Test", centers=SHOP_FIXTURES)


def png_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as img:
        return img.size


def ensure_demo_drawings(assets_dir: Path) -> dict[str, Path]:
    specs = (
        (SHEET_E101, "G-Line Shop Test", SHOP_FIXTURES),
        (SHEET_CEDAR_E101, "Cedar Lot Sample", CEDAR_FIXTURES),
        (SHEET_MILL_E101, "Mill Street Mock", MILL_FIXTURES),
    )
    out: dict[str, Path] = {}
    for filename, job_name, centers in specs:
        dest = assets_dir / filename
        write_sample_sheet(dest, job_name=job_name, centers=centers)
        out[filename] = dest
    return out
