/**
 * Vector markup overlays for pack sheets (PR #9 `markup_overlays` shape).
 *
 * Coordinates are normalized 0–1, origin top-left (same space as pack layout).
 * Persist to Supabase `markup_overlays` when configured; otherwise
 * localStorage keyed by request_id + sheet_id.
 *
 * TODO: migrate localStorage overlays to public.markup_overlays after
 * `supabase/migrations/20260918020000_share_markup_rfi_trial.sql` (and the
 * markup FK follow-up) are applied on the gc-field-log project.
 */

export const MARKUP_OVERLAYS_TABLE = "markup_overlays";
export const MARKUP_STORAGE_PREFIX = "gcfieldlog.markup";
export const MARKUP_RFI_PREFILL_KEY = "gcfieldlog.markup_rfi_prefill";

export type MarkupKind = "circle" | "box" | "arrow" | "text";
export type MarkupTool = "pan" | MarkupKind;

export type Point = { x: number; y: number };

export type MarkupCircle = {
  id: string;
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
};

export type MarkupBox = {
  id: string;
  kind: "box";
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MarkupArrow = {
  id: string;
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type MarkupTextNote = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
};

export type MarkupVector =
  | MarkupCircle
  | MarkupBox
  | MarkupArrow
  | MarkupTextNote;

export type MarkupVectorsJson = {
  items: MarkupVector[];
};

export type MarkupOverlayRecord = {
  id: string;
  request_id: string;
  sheet_id: string;
  vectors: MarkupVectorsJson;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

export type MarkupRfiPrefill = {
  requestId: string;
  overlayId: string;
  itemId: string;
  sheetId: string;
  sheetRev: string;
  kind: MarkupKind;
  subject: string;
  question: string;
  location: string;
  vectors: MarkupVectorsJson;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_BOX = 0.012;
const MIN_RADIUS = 0.01;
const MIN_ARROW = 0.02;
const HIT_PAD = 0.028;

export function markupStorageKey(requestId: string, sheetId: string): string {
  return `${MARKUP_STORAGE_PREFIX}:${requestId}:${sheetId}`;
}

export function newMarkupId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

export function isMarkupUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function roundNorm(value: number): number {
  return Math.round(clamp01(value) * 1e6) / 1e6;
}

export function emptyVectors(): MarkupVectorsJson {
  return { items: [] };
}

export function parseVectors(value: unknown): MarkupVectorsJson {
  if (!value || typeof value !== "object") return emptyVectors();
  const record = value as Record<string, unknown>;
  const raw = Array.isArray(record.items)
    ? record.items
    : Array.isArray(value)
      ? value
      : [];
  const items: MarkupVector[] = [];
  for (const entry of raw) {
    const item = asMarkupVector(entry);
    if (item) items.push(item);
  }
  return { items };
}

export function asMarkupVector(value: unknown): MarkupVector | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id : null;
  if (!id) return null;
  const kind = record.kind;
  if (kind === "circle") {
    const cx = asNum(record.cx);
    const cy = asNum(record.cy);
    const r = asNum(record.r);
    if (cx === null || cy === null || r === null || r <= 0) return null;
    return { id, kind: "circle", cx, cy, r };
  }
  if (kind === "box") {
    const x = asNum(record.x);
    const y = asNum(record.y);
    const w = asNum(record.w);
    const h = asNum(record.h);
    if (x === null || y === null || w === null || h === null || w <= 0 || h <= 0) {
      return null;
    }
    return { id, kind: "box", x, y, w, h };
  }
  if (kind === "arrow") {
    const x1 = asNum(record.x1);
    const y1 = asNum(record.y1);
    const x2 = asNum(record.x2);
    const y2 = asNum(record.y2);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return { id, kind: "arrow", x1, y1, x2, y2 };
  }
  if (kind === "text") {
    const x = asNum(record.x);
    const y = asNum(record.y);
    const text = typeof record.text === "string" ? record.text : "";
    if (x === null || y === null) return null;
    return { id, kind: "text", x, y, text };
  }
  return null;
}

function asNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function loadLocalOverlay(
  requestId: string,
  sheetId: string,
): MarkupOverlayRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(markupStorageKey(requestId, sheetId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return asOverlayRecord(parsed, requestId, sheetId);
  } catch {
    return null;
  }
}

export function saveLocalOverlay(record: MarkupOverlayRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      markupStorageKey(record.request_id, record.sheet_id),
      JSON.stringify({
        id: record.id,
        request_id: record.request_id,
        sheet_id: record.sheet_id,
        vectors: { items: record.vectors.items },
        updated_at: record.updated_at ?? new Date().toISOString(),
      }),
    );
  } catch {
    // Quota or private mode — drawing still works in memory.
  }
}

export function asOverlayRecord(
  value: unknown,
  fallbackRequestId: string,
  fallbackSheetId: string,
): MarkupOverlayRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id =
    typeof record.id === "string" && isMarkupUuid(record.id)
      ? record.id
      : newMarkupId();
  const requestId =
    typeof record.request_id === "string" && record.request_id.trim()
      ? record.request_id
      : fallbackRequestId;
  const sheetId =
    typeof record.sheet_id === "string" && record.sheet_id.trim()
      ? record.sheet_id
      : fallbackSheetId;
  return {
    id,
    request_id: requestId,
    sheet_id: sheetId,
    vectors: parseVectors(record.vectors),
    user_id: typeof record.user_id === "string" ? record.user_id : undefined,
    created_at: typeof record.created_at === "string" ? record.created_at : undefined,
    updated_at: typeof record.updated_at === "string" ? record.updated_at : undefined,
  };
}

export function writeMarkupRfiPrefill(prefill: MarkupRfiPrefill): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(MARKUP_RFI_PREFILL_KEY, JSON.stringify(prefill));
  } catch {
    // ignore
  }
}

export function readMarkupRfiPrefill(requestId: string): MarkupRfiPrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MARKUP_RFI_PREFILL_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (record.requestId !== requestId) return null;
    if (typeof record.overlayId !== "string" || typeof record.itemId !== "string") {
      return null;
    }
    if (typeof record.sheetId !== "string" || typeof record.kind !== "string") {
      return null;
    }
    if (
      record.kind !== "circle" &&
      record.kind !== "box" &&
      record.kind !== "arrow" &&
      record.kind !== "text"
    ) {
      return null;
    }
    return {
      requestId,
      overlayId: record.overlayId,
      itemId: record.itemId,
      sheetId: record.sheetId,
      sheetRev: typeof record.sheetRev === "string" ? record.sheetRev : "",
      kind: record.kind,
      subject: typeof record.subject === "string" ? record.subject : "",
      question: typeof record.question === "string" ? record.question : "",
      location: typeof record.location === "string" ? record.location : "",
      vectors: parseVectors(record.vectors),
    };
  } catch {
    return null;
  }
}

export function createMarkupFromGesture(input: {
  kind: Exclude<MarkupKind, "text">;
  start: Point;
  end: Point;
  aspect?: number;
  id?: string;
}): MarkupVector | null {
  const aspect = input.aspect && input.aspect > 0 ? input.aspect : 1;
  const id = input.id ?? newMarkupId();
  const start = { x: roundNorm(input.start.x), y: roundNorm(input.start.y) };
  const end = { x: roundNorm(input.end.x), y: roundNorm(input.end.y) };

  if (input.kind === "box") {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = roundNorm(Math.abs(end.x - start.x));
    const h = roundNorm(Math.abs(end.y - start.y));
    if (w < MIN_BOX || h < MIN_BOX) return null;
    return { id, kind: "box", x, y, w, h };
  }

  if (input.kind === "circle") {
    const cx = start.x;
    const cy = start.y;
    const r = roundNorm(Math.hypot(end.x - start.x, (end.y - start.y) / aspect));
    if (r < MIN_RADIUS) return null;
    return { id, kind: "circle", cx, cy, r };
  }

  const length = Math.hypot(end.x - start.x, end.y - start.y);
  if (length < MIN_ARROW) return null;
  return {
    id,
    kind: "arrow",
    x1: start.x,
    y1: start.y,
    x2: end.x,
    y2: end.y,
  };
}

export function createTextMarkup(input: {
  point: Point;
  text: string;
  id?: string;
}): MarkupTextNote {
  return {
    id: input.id ?? newMarkupId(),
    kind: "text",
    x: clamp01(input.point.x),
    y: clamp01(input.point.y),
    text: input.text.trim(),
  };
}

export function hitTestMarkup(
  item: MarkupVector,
  x: number,
  y: number,
  aspect = 1,
): boolean {
  const safeAspect = aspect > 0 ? aspect : 1;
  if (item.kind === "box") {
    return (
      x >= item.x - HIT_PAD &&
      x <= item.x + item.w + HIT_PAD &&
      y >= item.y - HIT_PAD &&
      y <= item.y + item.h + HIT_PAD
    );
  }
  if (item.kind === "circle") {
    const nx = (x - item.cx) / item.r;
    const ny = (y - item.cy) / (item.r * safeAspect);
    return nx * nx + ny * ny <= (1 + HIT_PAD / Math.max(item.r, MIN_RADIUS)) ** 2;
  }
  if (item.kind === "arrow") {
    return distanceToSegment(x, y, item.x1, item.y1, item.x2, item.y2) <= HIT_PAD;
  }
  return Math.abs(x - item.x) <= 0.12 && Math.abs(y - item.y) <= 0.05;
}

export function findMarkupAt(
  items: MarkupVector[],
  x: number,
  y: number,
  aspect = 1,
): MarkupVector | null {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item && hitTestMarkup(item, x, y, aspect)) return item;
  }
  return null;
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function markupKindLabel(kind: MarkupKind): string {
  if (kind === "circle") return "Circle";
  if (kind === "box") return "Box";
  if (kind === "arrow") return "Arrow";
  return "Note";
}

export function describeMarkup(item: MarkupVector): string {
  if (item.kind === "text") {
    const note = item.text.trim() || "(empty note)";
    return `Text note: ${note}`;
  }
  if (item.kind === "box") {
    return `Box markup at ${pct(item.x)}, ${pct(item.y)} (${pct(item.w)} × ${pct(item.h)} of the sheet).`;
  }
  if (item.kind === "circle") {
    return `Circle markup at ${pct(item.cx)}, ${pct(item.cy)} (radius ${pct(item.r)}).`;
  }
  return `Arrow markup from ${pct(item.x1)}, ${pct(item.y1)} to ${pct(item.x2)}, ${pct(item.y2)}.`;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function prefillRfiFromMarkup(input: {
  item: MarkupVector;
  sheetId: string;
  sheetRev: string;
  roomName: string;
  roomNumber?: string;
}): { subject: string; question: string; location: string } {
  const pin = input.sheetRev
    ? `${input.sheetId} Rev ${input.sheetRev}`
    : input.sheetId;
  const kind = markupKindLabel(input.item.kind);
  const location =
    input.roomName.trim() ||
    (input.roomNumber ? `Room ${input.roomNumber}` : "Room");
  const note =
    input.item.kind === "text" && input.item.text.trim()
      ? input.item.text.trim()
      : null;
  const subject = note
    ? `${note.slice(0, 72)}${note.length > 72 ? "…" : ""}`
    : `${kind} on ${pin} — ${location}`;
  const question = [
    `Field markup (${kind.toLowerCase()}) on ${pin}.`,
    describeMarkup(input.item),
    `Location: ${location}.`,
    "Please confirm the condition at this marked-up view. Vector overlay is attached on this draft (not a flattened image). Draft to the foreman only — not a Procore submit.",
  ].join(" ");
  return { subject, question, location };
}

export function buildMarkupRfiPrefill(input: {
  requestId: string;
  overlayId: string;
  item: MarkupVector;
  sheetId: string;
  sheetRev: string;
  roomName: string;
  roomNumber?: string;
  vectors: MarkupVectorsJson;
}): MarkupRfiPrefill {
  const fields = prefillRfiFromMarkup({
    item: input.item,
    sheetId: input.sheetId,
    sheetRev: input.sheetRev,
    roomName: input.roomName,
    roomNumber: input.roomNumber,
  });
  return {
    requestId: input.requestId,
    overlayId: input.overlayId,
    itemId: input.item.id,
    sheetId: input.sheetId,
    sheetRev: input.sheetRev,
    kind: input.item.kind,
    subject: fields.subject,
    question: fields.question,
    location: fields.location,
    vectors: { items: input.vectors.items },
  };
}

export function circleRadii(
  item: MarkupCircle,
  aspect: number,
): { rx: number; ry: number } {
  const safeAspect = aspect > 0 ? aspect : 1;
  return { rx: item.r, ry: item.r * safeAspect };
}

export function arrowHeadPoints(
  item: MarkupArrow,
  aspect: number,
): string {
  const dx = item.x2 - item.x1;
  const dy = (item.y2 - item.y1) / (aspect > 0 ? aspect : 1);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = 0.028;
  const wing = 0.014;
  const px = -uy;
  const py = ux;
  const tipX = item.x2;
  const tipY = item.y2;
  const bx = tipX - ux * head;
  const by = tipY - uy * head * (aspect > 0 ? aspect : 1);
  const l = `${bx + px * wing},${by + py * wing * (aspect > 0 ? aspect : 1)}`;
  const r = `${bx - px * wing},${by - py * wing * (aspect > 0 ? aspect : 1)}`;
  return `${tipX},${tipY} ${l} ${r}`;
}
