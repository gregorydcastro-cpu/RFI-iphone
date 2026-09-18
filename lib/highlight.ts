import type { Layout, NormalizedBBox } from "./pack";
import { layoutSheetId, pdfRectFromUnknown } from "./packNormalize";

/** Pad the room box ~8% of its size so the CTA stroke sits outside the walls. */
export const HIGHLIGHT_PAD_RATIO = 0.08;
/** Floor so a tiny closet still gets a visible oversized box. */
export const HIGHLIGHT_PAD_MIN = 0.012;
/** Architectural D (36x24") used only when the PDF has not reported page size. */
export const FALLBACK_PAGE_PTS = { width: 2592, height: 1728 };

export type ResolvedHighlight =
  | { type: "polygon"; points: [number, number][] }
  | { type: "bbox"; bbox: NormalizedBBox };

/** Axis-aligned box drawn around the room walls (SVG overlay, not baked). */
export type OversizedRoomBox = {
  type: "bbox";
  bbox: NormalizedBBox;
};

export function bboxFromPoints(points: [number, number][]): NormalizedBBox {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY),
  };
}

export function padBBox(
  bbox: NormalizedBBox,
  ratio = HIGHLIGHT_PAD_RATIO,
  minPad = HIGHLIGHT_PAD_MIN,
): NormalizedBBox {
  const padX = Math.max(minPad, bbox.w * ratio);
  const padY = Math.max(minPad, bbox.h * ratio);
  const x = Math.max(0, bbox.x - padX);
  const y = Math.max(0, bbox.y - padY);
  return {
    x,
    y,
    w: Math.min(1 - x, bbox.w + padX * 2),
    h: Math.min(1 - y, bbox.h + padY * 2),
  };
}

/** Convert a wall outline / bbox into an oversized axis-aligned box. */
export function oversizeRoomBox(highlight: ResolvedHighlight): OversizedRoomBox {
  const bbox =
    highlight.type === "polygon"
      ? bboxFromPoints(highlight.points)
      : highlight.bbox;
  return { type: "bbox", bbox: padBBox(bbox) };
}

function looksNormalized(points: [number, number][]): boolean {
  return points.every(([x, y]) => x >= 0 && y >= 0 && x <= 1.0001 && y <= 1.0001);
}

function pdfToNormalized(
  x: number,
  y: number,
  pw: number,
  ph: number,
  origin: "bottom-left" | "top-left",
): [number, number] {
  const nx = pw ? x / pw : x;
  const ny = origin === "top-left" ? (ph ? y / ph : y) : ph ? 1 - y / ph : y;
  return [nx, ny];
}

function convertPdfPoints(
  points: [number, number][],
  page: { width: number; height: number },
  origin: "bottom-left" | "top-left",
  units?: string,
): [number, number][] {
  const pdfUnits = /pdf/i.test(units ?? "") || !looksNormalized(points);
  if (!pdfUnits) return points;
  return points.map(([x, y]) =>
    pdfToNormalized(x, y, page.width, page.height, origin),
  );
}

function convertPdfBBox(
  box: { x: number; y: number; w: number; h: number },
  page: { width: number; height: number },
  origin: "bottom-left" | "top-left",
  units?: string,
): NormalizedBBox {
  const pdfUnits =
    /pdf/i.test(units ?? "") || box.w > 1.0001 || box.h > 1.0001 || box.x > 1.0001;
  if (!pdfUnits) {
    return { x: box.x, y: box.y, w: box.w, h: box.h };
  }
  const [x1, y1] = pdfToNormalized(box.x, box.y, page.width, page.height, origin);
  const [x2, y2] = pdfToNormalized(
    box.x + box.w,
    box.y + box.h,
    page.width,
    page.height,
    origin,
  );
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

function pageSize(
  layout: Layout | undefined,
  pagePts?: { width: number; height: number },
): { width: number; height: number } {
  const width =
    layout?.wall_bounds?.page_width_pts ??
    layout?.page_width_pts ??
    pagePts?.width ??
    FALLBACK_PAGE_PTS.width;
  const height =
    layout?.wall_bounds?.page_height_pts ??
    layout?.page_height_pts ??
    pagePts?.height ??
    FALLBACK_PAGE_PTS.height;
  return { width, height };
}

/**
 * Prefer live `wall_bounds` (polygon / bbox in pdf_pts or normalized),
 * then explicit normalized polygon, then normalized bbox, then
 * `layout.bbox_pdf_pts` (object or [x1,y1,x2,y2]) mapped to a 0–1 top-left rect.
 */
export function resolveHighlight(
  layout: Layout | undefined,
  pagePts?: { width: number; height: number },
): ResolvedHighlight | null {
  if (!layout) return null;
  const page = pageSize(layout, pagePts);
  const origin = layout.wall_bounds?.origin ?? "bottom-left";
  const bounds = layout.wall_bounds;

  if (bounds?.polygon && bounds.polygon.length >= 3) {
    return {
      type: "polygon",
      points: convertPdfPoints(bounds.polygon, page, origin, bounds.units),
    };
  }

  if (bounds?.bbox) {
    return {
      type: "bbox",
      bbox: convertPdfBBox(bounds.bbox, page, origin, bounds.units),
    };
  }

  if (layout.points && layout.points.length >= 3) {
    const units = looksNormalized(layout.points) ? "normalized" : "pdf_pts";
    return {
      type: "polygon",
      points: convertPdfPoints(layout.points, page, origin, units),
    };
  }

  if (layout.bbox) {
    return { type: "bbox", bbox: layout.bbox };
  }

  const pdfBox = pdfRectFromUnknown(layout.bbox_pdf_pts) ?? layout.bbox_pdf_pts;
  if (pdfBox) {
    return {
      type: "bbox",
      bbox: convertPdfBBox(pdfBox, page, origin, "pdf_pts"),
    };
  }

  return null;
}

/**
 * SVG overlay for a sheet. Always shown on the primary floor-plan page so
 * the crew can find the room. Also shown on `layout.sheet` / wall_bounds.sheet_id
 * when that is a different detailed sheet.
 */
export function highlightForSheet(
  layout: Layout | undefined,
  sheetId: string,
  pagePts?: { width: number; height: number },
  options?: { primarySheetId?: string },
): OversizedRoomBox | null {
  const tagged = layoutSheetId(layout);
  const isPrimary = options?.primarySheetId === sheetId;
  if (tagged && tagged !== sheetId && !isPrimary) return null;
  if (!tagged && options?.primarySheetId && !isPrimary) return null;
  const resolved = resolveHighlight(layout, pagePts);
  return resolved ? oversizeRoomBox(resolved) : null;
}
