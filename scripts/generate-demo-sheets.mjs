/**
 * Generates fictional Maple Point demo PDFs. Not production sheets.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

const PAGE_W = 1224;
const PAGE_H = 792;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public/packs");

function tl(x, y, w, h) {
  return {
    x: x * PAGE_W,
    y: PAGE_H - (y + h) * PAGE_H,
    w: w * PAGE_W,
    h: h * PAGE_H,
  };
}

function drawRoom(page, font, room, fill) {
  const r = tl(room.x, room.y, room.w, room.h);
  page.drawRectangle({
    x: r.x,
    y: r.y,
    width: r.w,
    height: r.h,
    color: fill,
    borderColor: rgb(0.15, 0.18, 0.22),
    borderWidth: 1.4,
  });
  const label = room.label;
  const size = 10;
  const textWidth = font.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: r.x + Math.max(8, (r.w - textWidth) / 2),
    y: r.y + r.h / 2 - 4,
    size,
    font,
    color: rgb(0.12, 0.14, 0.18),
  });
}

function drawTitleBlock(page, font, bold, sheet) {
  const x = PAGE_W - 360;
  const y = 18;
  page.drawRectangle({
    x,
    y,
    width: 342,
    height: 96,
    borderColor: rgb(0.12, 0.14, 0.18),
    borderWidth: 1.2,
    color: rgb(1, 1, 1),
  });
  page.drawText("MAPLE POINT MEDICAL OFFICE", {
    x: x + 10,
    y: y + 74,
    size: 11,
    font: bold,
    color: rgb(0.1, 0.12, 0.16),
  });
  page.drawText("Fictional demo job — not a live project", {
    x: x + 10,
    y: y + 58,
    size: 8,
    font,
    color: rgb(0.4, 0.35, 0.2),
  });
  page.drawText(sheet.title, {
    x: x + 10,
    y: y + 38,
    size: 10,
    font,
    color: rgb(0.15, 0.18, 0.22),
  });
  page.drawText(`${sheet.id}  ·  REV ${sheet.rev}  ·  17x11`, {
    x: x + 10,
    y: y + 20,
    size: 10,
    font: bold,
    color: rgb(0.15, 0.18, 0.22),
  });
  page.drawText("gcpullog.com room-pack demo", {
    x: x + 10,
    y: y + 6,
    size: 8,
    font,
    color: rgb(0.45, 0.48, 0.52),
  });
}

function drawGrid(page) {
  const step = 36;
  for (let x = 36; x < PAGE_W; x += step) {
    page.drawLine({
      start: { x, y: 120 },
      end: { x, y: PAGE_H - 48 },
      thickness: 0.3,
      color: rgb(0.78, 0.82, 0.86),
    });
  }
  for (let y = 120; y < PAGE_H - 48; y += step) {
    page.drawLine({
      start: { x: 36, y },
      end: { x: PAGE_W - 36, y },
      thickness: 0.3,
      color: rgb(0.78, 0.82, 0.86),
    });
  }
}

function drawHeader(page, bold, font, sheet) {
  page.drawText("MAPLE POINT MEDICAL OFFICE  —  LEVEL 1", {
    x: 40,
    y: PAGE_H - 28,
    size: 14,
    font: bold,
    color: rgb(0.1, 0.12, 0.16),
  });
  page.drawText(`${sheet.id} ${sheet.title}   |   FICTIONAL SAMPLE SHEET`, {
    x: 40,
    y: PAGE_H - 44,
    size: 9,
    font,
    color: rgb(0.35, 0.38, 0.42),
  });
  page.drawCircle({
    x: 56,
    y: 148,
    size: 16,
    borderWidth: 1.2,
    borderColor: rgb(0.15, 0.18, 0.22),
  });
  page.drawText("N", {
    x: 51.5,
    y: 158,
    size: 9,
    font: bold,
  });
  page.drawLine({
    start: { x: 56, y: 148 },
    end: { x: 56, y: 172 },
    thickness: 1.2,
    color: rgb(0.15, 0.18, 0.22),
  });
}

async function buildSheet(sheet, rooms, extras) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_W,
    height: PAGE_H,
    color: rgb(0.93, 0.94, 0.92),
  });
  drawGrid(page);
  drawHeader(page, bold, font, sheet);

  for (const room of rooms) {
    const fill = room.highlight
      ? rgb(1, 0.86, 0.55)
      : rgb(0.99, 0.99, 0.97);
    drawRoom(page, font, room, fill);
  }

  extras?.(page, font, bold);
  drawTitleBlock(page, font, bold, sheet);

  page.drawText("DEMO / NOT FOR CONSTRUCTION", {
    x: 420,
    y: 40,
    size: 10,
    font: bold,
    color: rgb(0.75, 0.2, 0.15),
    rotate: degrees(0),
  });

  return doc.save();
}

function drawClosetSymbols(page, font) {
  const closet = tl(0.2, 0.2, 0.3, 0.3);
  page.drawRectangle({
    x: closet.x + 24,
    y: closet.y + closet.h - 70,
    width: 54,
    height: 36,
    borderColor: rgb(0.15, 0.18, 0.22),
    borderWidth: 1.1,
    color: rgb(1, 1, 1),
  });
  page.drawText("PP-101", {
    x: closet.x + 30,
    y: closet.y + closet.h - 52,
    size: 8,
    font,
  });
  for (let i = 0; i < 4; i += 1) {
    page.drawRectangle({
      x: closet.x + 100 + i * 28,
      y: closet.y + 28,
      width: 16,
      height: 10,
      borderWidth: 0.8,
      borderColor: rgb(0.15, 0.18, 0.22),
    });
  }
  page.drawText("J-boxes", {
    x: closet.x + 100,
    y: closet.y + 16,
    size: 7,
    font,
    color: rgb(0.3, 0.32, 0.36),
  });
}

const roomsE101 = [
  { x: 0.2, y: 0.2, w: 0.3, h: 0.3, label: "ELECTRICAL CLOSET 101", highlight: true },
  { x: 0.52, y: 0.2, w: 0.2, h: 0.3, label: "EXAM 102" },
  { x: 0.74, y: 0.2, w: 0.2, h: 0.3, label: "EXAM 103" },
  { x: 0.2, y: 0.5, w: 0.74, h: 0.12, label: "CORRIDOR C1" },
  { x: 0.2, y: 0.64, w: 0.35, h: 0.24, label: "WAITING 110" },
  { x: 0.57, y: 0.64, w: 0.15, h: 0.24, label: "IT 111" },
  { x: 0.74, y: 0.64, w: 0.2, h: 0.24, label: "STAFF 112" },
];

const roomsE102 = roomsE101.map((room) => ({ ...room, highlight: false }));

mkdirSync(outDir, { recursive: true });

const e101 = await buildSheet(
  { id: "E-101", rev: "A", title: "LEVEL 1 POWER PLAN" },
  roomsE101,
  drawClosetSymbols,
);
const e102 = await buildSheet(
  { id: "E-102", rev: "A", title: "LEVEL 1 LIGHTING PLAN" },
  roomsE102,
  (page, font) => {
    for (const room of roomsE102) {
      const r = tl(room.x, room.y, room.w, room.h);
      page.drawCircle({
        x: r.x + r.w / 2,
        y: r.y + r.h / 2 + 16,
        size: 5,
        borderWidth: 0.9,
        borderColor: rgb(0.15, 0.18, 0.22),
      });
      page.drawText("A1", {
        x: r.x + r.w / 2 - 6,
        y: r.y + r.h / 2 + 24,
        size: 6,
        font,
      });
    }
  },
);

writeFileSync(join(outDir, "maple-point-e101.pdf"), e101);
writeFileSync(join(outDir, "maple-point-e102.pdf"), e102);
console.log("wrote Maple Point demo sheets");
