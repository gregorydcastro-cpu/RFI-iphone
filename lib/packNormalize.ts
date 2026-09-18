import type {
  Layout,
  NormalizedBBox,
  PdfPointBBox,
  RoomPack,
  Sheet,
  WallBounds,
} from "./pack";

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "job"
  );
}

export function driveFileId(url: string): string | null {
  const file = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (file?.[1]) return file[1];
  const query = url.match(/[?&]id=([^&]+)/i);
  return query?.[1] ? decodeURIComponent(query[1]) : null;
}

export function driveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

function isUsablePdfLocation(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function urlCandidatesFromUnknown(value: unknown): string[] {
  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") {
    const trimmed = parsed.trim();
    return trimmed ? [trimmed] : [];
  }
  const rec = asRecord(parsed);
  if (!rec) return [];
  const out: string[] = [];
  for (const key of ["pdf", "preview", "crop", "path", "url", "href", "src"]) {
    const item = rec[key];
    if (typeof item === "string" && item.trim()) out.push(item.trim());
  }
  return out;
}

function normalizePdfLocation(url: string): string {
  const id = driveFileId(url);
  return id ? driveDownloadUrl(id) : url;
}

/**
 * Live bot rows often store `pdf: ""` and put a Drive *view* URL on
 * `crop` / `preview` (`https://drive.google.com/file/d/<id>/view`).
 * Prefer a non-empty same-origin or absolute `pdf`; otherwise extract a
 * Drive file id from crop, then preview.
 */
export function resolveSheetPdf(sheet: Pick<Sheet, "pdf" | "preview"> & {
  crop?: unknown;
}): string {
  const pdf = typeof sheet.pdf === "string" ? sheet.pdf.trim() : "";
  if (pdf && isUsablePdfLocation(pdf)) return normalizePdfLocation(pdf);

  for (const source of [sheet.crop, sheet.preview]) {
    for (const candidate of urlCandidatesFromUnknown(source)) {
      const id = driveFileId(candidate);
      if (id) return driveDownloadUrl(id);
      if (isUsablePdfLocation(candidate)) return candidate;
    }
  }
  return "";
}

export function numberPairList(value: unknown): [number, number][] | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined;
  const points: [number, number][] = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length < 2) return undefined;
    const x = Number(item[0]);
    const y = Number(item[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    points.push([x, y]);
  }
  return points;
}

export function pdfRectFromUnknown(value: unknown): PdfPointBBox | undefined {
  if (!value) return undefined;
  if (Array.isArray(value) && value.length >= 4) {
    const nums = value.slice(0, 4).map((item) => Number(item));
    if (nums.some((n) => !Number.isFinite(n))) return undefined;
    const x1 = Math.min(nums[0], nums[2]);
    const y1 = Math.min(nums[1], nums[3]);
    const x2 = Math.max(nums[0], nums[2]);
    const y2 = Math.max(nums[1], nums[3]);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  const rec = asRecord(value);
  if (!rec) return undefined;
  const x = Number(rec.x);
  const y = Number(rec.y);
  const w = Number(rec.w ?? rec.width);
  const h = Number(rec.h ?? rec.height);
  if (![x, y, w, h].every(Number.isFinite)) return undefined;
  return { x, y, w, h };
}

function coerceWallBounds(value: unknown): WallBounds | undefined {
  const rec = asRecord(parseMaybeJson(value));
  if (!rec) return undefined;
  const bbox = pdfRectFromUnknown(rec.bbox ?? rec.bbox_pdf_pts);
  const polygon = numberPairList(rec.polygon ?? rec.points);
  const sheetId = asText(rec.sheet_id) ?? asText(rec.sheet);
  const units = asText(rec.units);
  const pageWidth = Number(rec.page_width_pts ?? rec.pageWidth);
  const pageHeight = Number(rec.page_height_pts ?? rec.pageHeight);
  if (!bbox && !polygon && !sheetId) return undefined;
  return {
    sheet_id: sheetId,
    units,
    bbox,
    polygon,
    page_width_pts: Number.isFinite(pageWidth) ? pageWidth : undefined,
    page_height_pts: Number.isFinite(pageHeight) ? pageHeight : undefined,
    origin: rec.origin === "top-left" ? "top-left" : "bottom-left",
  };
}

export function layoutSheetId(layout: Layout | undefined): string | undefined {
  return layout?.sheet || layout?.wall_bounds?.sheet_id || layout?.sheet_id;
}

export function coerceLayout(raw: unknown): Layout {
  const rec = asRecord(parseMaybeJson(raw)) ?? {};
  const nestedBounds =
    coerceWallBounds(rec.wall_bounds) ??
    coerceWallBounds(rec.bounds) ??
    undefined;
  const bboxPdf = pdfRectFromUnknown(rec.bbox_pdf_pts);
  const points = numberPairList(rec.points);
  const bboxRec = asRecord(rec.bbox);
  const bbox =
    bboxRec &&
    [bboxRec.x, bboxRec.y, bboxRec.w, bboxRec.h].every((n) =>
      Number.isFinite(Number(n)),
    )
      ? {
          x: Number(bboxRec.x),
          y: Number(bboxRec.y),
          w: Number(bboxRec.w),
          h: Number(bboxRec.h),
        }
      : pdfRectFromUnknown(rec.bbox);

  const pageWidth = Number(
    rec.page_width_pts ?? nestedBounds?.page_width_pts,
  );
  const pageHeight = Number(
    rec.page_height_pts ?? nestedBounds?.page_height_pts,
  );

  const layout: Layout = {
    sheet:
      asText(rec.sheet) ??
      nestedBounds?.sheet_id ??
      asText(rec.sheet_id),
    sheet_id: asText(rec.sheet_id),
    type: rec.type === "bbox" ? "bbox" : rec.type === "polygon" ? "polygon" : undefined,
    points,
    bbox: bbox && bbox.w <= 1 && bbox.h <= 1 ? (bbox as NormalizedBBox) : undefined,
    bbox_pdf_pts: bboxPdf ?? (bbox && (bbox.w > 1 || bbox.h > 1) ? bbox : undefined),
    locator: asText(rec.locator) ?? asText(asRecord(parseMaybeJson(rec.locator))?.label),
    page_width_pts: Number.isFinite(pageWidth) ? pageWidth : undefined,
    page_height_pts: Number.isFinite(pageHeight) ? pageHeight : undefined,
    wall_bounds: nestedBounds,
    room: rec.room as Layout["room"],
    floor: asText(rec.floor),
  };
  return layout;
}

function coerceProject(value: unknown, requestId: string): RoomPack["project"] {
  if (typeof value === "string" && value.trim()) {
    const name = value.trim();
    return { id: slugify(name), name, slug: slugify(name) };
  }
  const rec = asRecord(value);
  const name = asText(rec?.name) ?? asText(rec?.title) ?? requestId;
  const id = asText(rec?.id) ?? slugify(name);
  const slug = asText(rec?.slug) ?? slugify(name);
  return { id, name, slug };
}

function coerceRoom(value: unknown, layout: Layout): RoomPack["room"] {
  if (typeof value === "string" || typeof value === "number") {
    const number = String(value).trim();
    const fromLocator = layout.locator;
    return {
      id: number || "room",
      name: fromLocator || (number ? `Room ${number}` : "Room"),
      number: number || undefined,
    };
  }
  const rec = asRecord(value);
  const number = asText(rec?.number) ?? asText(rec?.id);
  const name = asText(rec?.name) ?? layout.locator ?? (number ? `Room ${number}` : "Room");
  return {
    id: asText(rec?.id) ?? number ?? "room",
    name,
    number,
  };
}

/**
 * Accept both Maple Point demo JSON and live Procore-bot pack_data
 * (string project/room, wall_bounds, Drive preview links, empty rev).
 */
export function coerceRoomPack(raw: unknown): RoomPack | null {
  const rec = asRecord(raw);
  if (!rec || !Array.isArray(rec.sheets)) return null;

  const requestId = asText(rec.request_id) ?? "pack";
  const layout = coerceLayout(rec.layout ?? rec.wall_bounds);
  if (!layout.wall_bounds) {
    const topBounds = coerceWallBounds(rec.wall_bounds);
    if (topBounds) {
      layout.wall_bounds = topBounds;
      layout.sheet = layout.sheet ?? topBounds.sheet_id;
    }
  }

  const project = coerceProject(rec.project, requestId);
  const room = coerceRoom(rec.room, layout);
  const locator = parseMaybeJson(rec.locator);
  const locatorRec = asRecord(locator);
  if (!layout.locator && asText(locatorRec?.label)) {
    layout.locator = asText(locatorRec?.label);
  }
  if (!layout.sheet && asText(locatorRec?.sheet_id)) {
    layout.sheet = asText(locatorRec?.sheet_id);
  }

  return {
    ...(rec as object),
    schema: "gcpullog.room_pack.v1",
    status: asText(rec.status) ?? "ready",
    request_id: requestId,
    pulled_at: asText(rec.pulled_at),
    project,
    room,
    sheets: rec.sheets as Sheet[],
    rfis: Array.isArray(rec.rfis) ? (rec.rfis as RoomPack["rfis"]) : [],
    layout,
    actions: Array.isArray(rec.actions)
      ? (rec.actions as RoomPack["actions"])
      : [],
  } as RoomPack;
}
