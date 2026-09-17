import type { Layout, NormalizedBBox } from "./pack";

export type ResolvedHighlight =
  | { type: "polygon"; points: [number, number][] }
  | { type: "bbox"; bbox: NormalizedBBox };

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

export function highlightForSheet(
  layout: Layout | undefined,
  sheetId: string,
  pagePts?: { width: number; height: number },
): ResolvedHighlight | null {
  if (layout?.sheet && layout.sheet !== sheetId) return null;
  return resolveHighlight(layout, pagePts);
}
