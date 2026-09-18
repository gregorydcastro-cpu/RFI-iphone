/**
 * Map Procore REST drawing revisions / RFIs to gcpullog.room_pack.v1.
 * GET-only shapes — never used to submit RFIs or POs.
 */

import type { DemoJob } from "./jobs";
import type { Rfi, RoomPack, Sheet } from "./pack";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function mapDrawingRevisionToSheet(raw: unknown): Sheet | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  if (rec.obsolete === true) return null;
  if (rec.current === false) return null;

  const id =
    asText(rec.drawing_number) ??
    asText(rec.number) ??
    asText(rec.sheet_number);
  if (!id) return null;

  const rev =
    asText(rec.revision_number) ?? asText(rec.revision) ?? asText(rec.rev) ?? "";
  const title = asText(rec.title) ?? asText(rec.name);
  const discipline = disciplineFromRevision(rec);
  const pdf =
    asText(rec.pdf_url) ??
    asText(rec.url) ??
    asText(asRecord(rec.pdf)?.url) ??
    "";

  return {
    id,
    rev,
    pdf,
    preview: null,
    crop: null,
    title,
    name: title,
    discipline,
  };
}

function disciplineFromRevision(
  rec: Record<string, unknown>,
): string | null {
  const direct = asText(rec.discipline) ?? asText(rec.drawing_discipline);
  if (direct) return normalizeDiscipline(direct);
  const nested =
    asText(asRecord(rec.drawing_discipline)?.name) ??
    asText(asRecord(rec.discipline)?.name);
  return nested ? normalizeDiscipline(nested) : null;
}

function normalizeDiscipline(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower.startsWith("arch")) return "architectural";
  if (lower.startsWith("light") || lower.includes("lighting")) return "lighting";
  if (lower.startsWith("elec")) return "electrical";
  return lower;
}

export function mapProcoreRfi(raw: unknown): Rfi | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const status = (asText(rec.status) ?? asText(rec.translated_status) ?? "")
    .trim()
    .toLowerCase();
  if (status === "recycled" || status === "draft") return null;

  const id = readNestedId(rec) ?? asText(rec.uuid);
  const number =
    asText(rec.formatted_number) ??
    asText(rec.number) ??
    asText(rec.position) ??
    id;
  const title =
    asText(rec.subject) ?? asText(rec.title) ?? asText(rec.question) ?? "";
  if (!id || !number || !title) return null;

  return {
    id,
    number,
    title,
    status: status || "open",
    url: asText(rec.url) ?? asText(rec.app_url),
  };
}

function readNestedId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    return readNestedId((value as { id: unknown }).id);
  }
  return null;
}

export function restRoomPackFields(input: {
  job: DemoJob;
  room: string;
  requestId: string;
  projectId: string;
  sheets: Sheet[];
  rfis: Rfi[];
}): Pick<
  RoomPack,
  "schema" | "status" | "request_id" | "project" | "room" | "sheets" | "rfis" | "layout"
> {
  const roomNumber = input.room.trim();
  const primary =
    input.sheets.find((sheet) => sheet.discipline === "architectural") ??
    input.sheets.find((sheet) => /^A[-_.]?\d/i.test(sheet.id)) ??
    input.sheets[0];

  return {
    schema: "gcpullog.room_pack.v1",
    status: "ready",
    request_id: input.requestId,
    project: {
      id: input.projectId,
      name: input.job.name,
      slug: input.job.slug,
    },
    room: {
      id: roomNumber ? `room-${roomNumber}` : "room",
      name: roomNumber ? `Room ${roomNumber}` : "Room",
      number: roomNumber || undefined,
    },
    sheets: input.sheets,
    rfis: input.rfis,
    layout: {
      sheet: primary?.id,
      locator: roomNumber ? `Room ${roomNumber}` : undefined,
    },
  };
}

export function mergeCachedLayout(
  restPack: RoomPack,
  cached: RoomPack | null,
): RoomPack {
  if (!cached) return restPack;
  const hasOutline =
    Boolean(restPack.layout.wall_bounds) ||
    Boolean(restPack.layout.points?.length) ||
    Boolean(restPack.layout.bbox) ||
    Boolean(restPack.layout.bbox_pdf_pts);
  if (hasOutline) return restPack;

  const cacheById = new Map(cached.sheets.map((sheet) => [sheet.id, sheet]));
  const sheets = restPack.sheets.map((sheet) => {
    if (sheet.pdf) return sheet;
    const prev = cacheById.get(sheet.id);
    if (!prev) return sheet;
    return {
      ...sheet,
      pdf: prev.pdf,
      preview: prev.preview ?? sheet.preview,
      crop: prev.crop ?? sheet.crop,
    };
  });

  return {
    ...restPack,
    layout: {
      ...cached.layout,
      sheet: restPack.layout.sheet ?? cached.layout.sheet,
      locator: restPack.layout.locator ?? cached.layout.locator,
    },
    takeoff: restPack.takeoff ?? cached.takeoff,
    sheets,
  };
}
