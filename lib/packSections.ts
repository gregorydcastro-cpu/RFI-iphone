import type { Sheet } from "./pack.ts";
import { resolveSheetPdf } from "./packNormalize.ts";
import { viewerSheetPdfSrc } from "./sheetPdfUrl.ts";

/** Fragment target for the primary plan. */
export const PACK_FLOOR_PLAN_ID = "floor-plan";

/** Fragment target for the RFI and actions block. */
export const PACK_RFIS_ID = "rfis";

const RESERVED_SECTION_IDS = [
  PACK_FLOOR_PLAN_ID,
  PACK_RFIS_ID,
  "detail-sheets",
  "sheets",
  "main-content",
] as const;

/** Plain `#id` href. Works with JavaScript off. */
export function packSectionHref(targetId: string): string {
  return `#${targetId}`;
}

function sanitizedSheetToken(sheetId: string): string {
  const token = sheetId.replace(/[^a-zA-Z0-9_-]/g, "-");
  return token || "sheet";
}

/**
 * One unique fragment id per detail sheet. The primary plan keeps
 * `floor-plan`, so these ids never reuse that or the other pack targets.
 */
export function packDetailSections<T extends { id: string }>(
  sheets: T[],
): { sheet: T; targetId: string }[] {
  const used = new Set<string>(RESERVED_SECTION_IDS);
  return sheets.map((sheet) => {
    const base = `sheet-${sanitizedSheetToken(sheet.id)}`;
    let targetId = base;
    let n = 2;
    while (used.has(targetId)) {
      targetId = `${base}-${n}`;
      n += 1;
    }
    used.add(targetId);
    return { sheet, targetId };
  });
}

/** Same URL the viewer already fetches. Empty when the sheet has no file. */
export function sheetFileHref(input: {
  requestId: string;
  sheet: Pick<Sheet, "id" | "pdf" | "preview" | "crop">;
}): string {
  return viewerSheetPdfSrc({
    requestId: input.requestId,
    sheetId: input.sheet.id,
    pdfUrl: resolveSheetPdf(input.sheet),
  });
}
