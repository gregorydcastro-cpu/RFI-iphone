import type { Layout, NormalizedBBox } from "./pack";

/** Pad the room box ~8% of its size so the CTA stroke sits outside the walls. */
export const HIGHLIGHT_PAD_RATIO = 0.08;
/** Floor so a tiny closet still gets a visible oversized box. */
export const HIGHLIGHT_PAD_MIN = 0.012;

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

/**
 * Prefer an explicit normalized polygon, then a normalized bbox, then
 * Procore `layout.bbox_pdf_pts` mapped into a 0–1 top-left rect.
 */
export function resolveHighlight(
  layout: Layout | undefined,
  pagePts?: { width: number; height: number },
): ResolvedHighlight | null {
  if (!layout) return null;

  if (layout.points && layout.points.length >= 3) {
    return { type: "polygon", points: layout.points };
  }

  if (layout.bbox) {
    return { type: "bbox", bbox: layout.bbox };
  }

  if (layout.bbox_pdf_pts) {
    const pw = layout.page_width_pts ?? pagePts?.width ?? 1224;
    const ph = layout.page_height_pts ?? pagePts?.height ?? 792;
    const box = layout.bbox_pdf_pts;
    return {
      type: "bbox",
      bbox: {
        x: box.x / pw,
        y: 1 - (box.y + box.h) / ph,
        w: box.w / pw,
        h: box.h / ph,
      },
    };
  }

  return null;
}

/**
 * SVG overlay for a sheet. Always shown on the primary floor-plan page so
 * the crew can find the room. Also shown on `layout.sheet` when that is a
 * different detailed sheet.
 */
export function highlightForSheet(
  layout: Layout | undefined,
  sheetId: string,
  pagePts?: { width: number; height: number },
  options?: { primarySheetId?: string },
): OversizedRoomBox | null {
  const tagged = layout?.sheet;
  const isPrimary = options?.primarySheetId === sheetId;
  if (tagged && tagged !== sheetId && !isPrimary) return null;
  if (!tagged && options?.primarySheetId && !isPrimary) return null;
  const resolved = resolveHighlight(layout, pagePts);
  return resolved ? oversizeRoomBox(resolved) : null;
}
