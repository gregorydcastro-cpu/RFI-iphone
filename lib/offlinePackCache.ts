import {
  formatPulledAt,
  primaryRevisionStamp,
  sheetRevisionLabel,
  type RevisionStamp,
  type RoomPack,
  type Sheet,
} from "./pack.ts";
import { resolveSheetPdf } from "./packNormalize.ts";
import { isShortPdfDownload } from "./sheetPdfLoad.ts";
import { isPdfMagic, viewerSheetPdfSrc } from "./sheetPdfUrl.ts";

/**
 * Client-side offline pack cache (device only).
 *
 * Live website views always re-pull from Procore / `room_packs` with
 * `cache: "no-store"`. This module is **not** a second Procore path and is
 * never the online source of truth.
 *
 * Expiry — **calendar day `America/New_York`** ("day's packs"):
 * a snapshot is valid while `packCalendarDayKey(cachedAt)` equals
 * `packCalendarDayKey(now)`. At midnight in that zone the previous day's
 * packs expire. This is not 24h sliding and not `pulled_at` (that stamp is
 * the Procore pull time, shown in the viewer).
 */
export const OFFLINE_PACK_SCHEMA = "gcfieldlog.offline_pack.v1" as const;
export const OFFLINE_PACK_TZ = "America/New_York";
export const OFFLINE_PACK_PREFIX = "gcfieldlog.offline-pack.v1";
export const OFFLINE_PACK_LATEST_PREFIX = "gcfieldlog.offline-pack.latest.v1";
export const OFFLINE_PDF_CACHE = "gcfieldlog-offline-pdfs-v1";

export type OfflineBlobRef = {
  sheetId: string;
  rev: string;
  src: string;
};

export type OfflinePackSnapshot = {
  schema: typeof OFFLINE_PACK_SCHEMA;
  cacheKey: string;
  latestKey: string;
  projectId: string;
  requestId: string;
  roomId: string;
  revisionStamp: RevisionStamp | null;
  cachedAt: string;
  dayKey: string;
  pack: RoomPack;
  blobRefs: OfflineBlobRef[];
};

export type OfflinePackLookup = {
  projectId?: string | null;
  requestId: string;
  roomId?: string | null;
  revisionStamp?: RevisionStamp | null;
};

const KEY_PART = /[^a-zA-Z0-9._-]+/g;

export function sanitizeOfflineKeyPart(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "_";
  const cleaned = trimmed.replace(KEY_PART, "-").replace(/^-+|-+$/g, "");
  return cleaned || "_";
}

export function packCalendarDayKey(
  at: Date | string | number = new Date(),
  timeZone: string = OFFLINE_PACK_TZ,
): string {
  const date = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(date.getTime())) return "invalid";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function isOfflineSnapshotExpired(
  snapshot: Pick<OfflinePackSnapshot, "cachedAt" | "dayKey">,
  now: Date | string | number = new Date(),
  timeZone: string = OFFLINE_PACK_TZ,
): boolean {
  const day = packCalendarDayKey(now, timeZone);
  const cachedDay =
    snapshot.dayKey || packCalendarDayKey(snapshot.cachedAt, timeZone);
  return !day || !cachedDay || day === "invalid" || cachedDay === "invalid"
    ? true
    : cachedDay !== day;
}

export function revisionStampKeyPart(
  stamp: RevisionStamp | null | undefined,
): string {
  if (!stamp) return "_:_";
  return `${sanitizeOfflineKeyPart(stamp.drawing)}:${sanitizeOfflineKeyPart(stamp.rev)}`;
}

export function offlinePackCacheKey(input: OfflinePackLookup): string {
  const stamp = revisionStampKeyPart(input.revisionStamp ?? null);
  return [
    OFFLINE_PACK_PREFIX,
    sanitizeOfflineKeyPart(input.projectId),
    sanitizeOfflineKeyPart(input.requestId),
    sanitizeOfflineKeyPart(input.roomId),
    stamp,
  ].join(":");
}

export function offlinePackLatestKey(input: OfflinePackLookup): string {
  return [
    OFFLINE_PACK_LATEST_PREFIX,
    sanitizeOfflineKeyPart(input.projectId),
    sanitizeOfflineKeyPart(input.requestId),
    sanitizeOfflineKeyPart(input.roomId),
  ].join(":");
}

export function blobRefsForPack(
  pack: Pick<RoomPack, "sheets" | "request_id">,
  requestId?: string,
): OfflineBlobRef[] {
  const id = requestId || pack.request_id;
  const seen = new Set<string>();
  const refs: OfflineBlobRef[] = [];
  for (const sheet of pack.sheets ?? []) {
    const src = viewerSheetPdfSrc({
      requestId: id,
      sheetId: sheet.id,
      pdfUrl: resolveSheetPdf(sheet),
    });
    if (!src || seen.has(src)) continue;
    seen.add(src);
    refs.push({ sheetId: sheet.id, rev: sheet.rev, src });
  }
  return refs;
}

export function lookupFromPack(
  pack: RoomPack,
  overrides?: {
    requestId?: string;
    projectId?: string;
    roomId?: string;
  },
): OfflinePackLookup {
  return {
    projectId: overrides?.projectId || pack.project.slug || pack.project.id,
    requestId: overrides?.requestId || pack.request_id,
    roomId:
      overrides?.roomId ||
      pack.room.id ||
      pack.room.number ||
      pack.room.name,
    revisionStamp: primaryRevisionStamp(pack) ?? null,
  };
}

export function buildOfflinePackSnapshot(input: {
  pack: RoomPack;
  requestId?: string;
  projectId?: string;
  roomId?: string;
  cachedAt?: string;
}): OfflinePackSnapshot {
  const cachedAt = input.cachedAt ?? new Date().toISOString();
  const lookup = lookupFromPack(input.pack, input);
  const cacheKey = offlinePackCacheKey(lookup);
  const latestKey = offlinePackLatestKey(lookup);
  return {
    schema: OFFLINE_PACK_SCHEMA,
    cacheKey,
    latestKey,
    projectId: sanitizeOfflineKeyPart(lookup.projectId),
    requestId: lookup.requestId,
    roomId: sanitizeOfflineKeyPart(lookup.roomId),
    revisionStamp: lookup.revisionStamp ?? null,
    cachedAt,
    dayKey: packCalendarDayKey(cachedAt),
    pack: input.pack,
    blobRefs: blobRefsForPack(input.pack, lookup.requestId),
  };
}

export function shouldWriteOfflineSnapshot(input: {
  pack?: RoomPack | null;
  gotLivePack: boolean;
}): boolean {
  if (!input.gotLivePack || !input.pack) return false;
  return (input.pack.sheets?.length ?? 0) > 0;
}

/** Call only after the live no-store fetch/refresh has been attempted. */
export function shouldUseOfflineFallback(input: {
  gotLivePack: boolean;
}): boolean {
  return !input.gotLivePack;
}

/**
 * Fallback only when the live no-store fetch did not yield a pack.
 * HTTP 403 (view-only pull) is not a network miss — callers should not
 * pass that as fetchFailed unless the subsequent live GET also failed.
 */
export function isOfflineFetchFailure(input: {
  ok?: boolean;
  status?: number;
  threw?: boolean;
}): boolean {
  if (input.threw) return true;
  if (input.status === 403) return false;
  if (input.ok) return false;
  return true;
}

export function snapshotMatchesLookup(
  snapshot: Pick<
    OfflinePackSnapshot,
    "requestId" | "projectId" | "roomId" | "revisionStamp"
  >,
  lookup: OfflinePackLookup,
): boolean {
  if (snapshot.requestId !== lookup.requestId) return false;
  if (
    lookup.projectId &&
    sanitizeOfflineKeyPart(lookup.projectId) !== "_" &&
    snapshot.projectId !== sanitizeOfflineKeyPart(lookup.projectId)
  ) {
    return false;
  }
  if (
    lookup.roomId &&
    sanitizeOfflineKeyPart(lookup.roomId) !== "_" &&
    snapshot.roomId !== sanitizeOfflineKeyPart(lookup.roomId)
  ) {
    return false;
  }
  if (lookup.revisionStamp) {
    const have = snapshot.revisionStamp;
    if (
      !have ||
      have.drawing !== lookup.revisionStamp.drawing ||
      have.rev !== lookup.revisionStamp.rev
    ) {
      return false;
    }
  }
  return true;
}

export function pickValidOfflineSnapshot(
  snapshots: OfflinePackSnapshot[],
  lookup: OfflinePackLookup,
  now: Date | string | number = new Date(),
): OfflinePackSnapshot | null {
  const valid = snapshots.filter(
    (snapshot) =>
      snapshot.schema === OFFLINE_PACK_SCHEMA &&
      !isOfflineSnapshotExpired(snapshot, now) &&
      snapshotMatchesLookup(snapshot, lookup),
  );
  if (valid.length === 0) return null;
  valid.sort((a, b) => (a.cachedAt < b.cachedAt ? 1 : a.cachedAt > b.cachedAt ? -1 : 0));
  return valid[0] ?? null;
}

export function offlineBannerText(
  snapshot: Pick<OfflinePackSnapshot, "cachedAt" | "revisionStamp" | "pack">,
): string {
  const when =
    formatPulledAt(snapshot.cachedAt) ??
    formatPulledAt(snapshot.pack.pulled_at) ??
    snapshot.cachedAt;
  const stamp = snapshot.revisionStamp
    ? sheetRevisionLabel({
        id: snapshot.revisionStamp.drawing,
        rev: snapshot.revisionStamp.rev,
      })
    : null;
  const suffix = stamp ? ` · ${stamp}` : "";
  return `Offline — showing cached pack from ${when}${suffix}`;
}

/**
 * Context-bar line while `OfflinePackBanner` carries the time and stamp.
 * Kept short so the title row does not repeat the banner sentence.
 */
export const OFFLINE_STATUS_LINE = "Device snapshot · not a live pull.";

/**
 * Sheet strip when live PDF bytes miss and a device copy paints.
 * Sits above the markup toolbar — that bar used to cover this note.
 */
export const OFFLINE_SHEET_NOTE = "Offline copy · live sheet didn't load";

export function sheetBlobKey(sheet: Pick<Sheet, "id" | "rev">): string {
  return `${sheet.id}::${sheet.rev}`;
}

/**
 * Absolute Cache Storage key for a viewer PDF URL.
 * Hash is stripped so `#page` fragments do not split one sheet into two entries.
 * Same string the service worker uses — a `Request` with `cache: "no-store"`
 * cannot be passed to `cache.put` (browsers reject it).
 */
export function absolutePdfCacheUrl(src: string, origin?: string): string {
  const base =
    origin ??
    (typeof location !== "undefined" ? location.origin : "http://localhost");
  const url = new URL(src, base);
  url.hash = "";
  return url.href;
}

/**
 * A body is safe to keep as a day's sheet only when it is a real PDF and the
 * download was not cut short. HTML/JSON error pages must not replace a good copy.
 */
export function pdfBytesAreCacheable(
  bytes: Uint8Array,
  headers?: { get(name: string): string | null },
): boolean {
  if (!isPdfMagic(bytes)) return false;
  if (!headers) return true;
  const type = (headers.get("content-type") ?? "").toLowerCase();
  if (type.includes("html") || type.includes("json")) return false;
  return !isShortPdfDownload(
    bytes.byteLength,
    headers.get("content-length"),
    headers.get("content-encoding"),
  );
}

/** Cache names from older workers. Never includes the live PDF cache. */
export function staleOfflinePdfCacheNames(
  names: string[],
  current: string = OFFLINE_PDF_CACHE,
): string[] {
  const prefix = "gcfieldlog-offline-pdfs-";
  return names.filter((name) => name.startsWith(prefix) && name !== current);
}

/**
 * PDF URLs stored in Cache Storage that no surviving day's snapshot still references.
 * `cachedUrls` and `keepUrls` may be relative or absolute; comparison is on the absolute href.
 */
export function pdfCacheUrlsToDrop(
  cachedUrls: string[],
  keepUrls: string[],
  origin?: string,
): string[] {
  const keep = new Set(
    keepUrls.map((url) => absolutePdfCacheUrl(url, origin)),
  );
  return cachedUrls.filter(
    (url) => !keep.has(absolutePdfCacheUrl(url, origin)),
  );
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name =
    "name" in error && error.name != null ? String(error.name) : "";
  if (name === "QuotaExceededError") return true;
  const message =
    "message" in error && error.message != null ? String(error.message) : "";
  return /quota/i.test(message);
}

/**
 * What the pack page should do with one `/api/room-pack/refresh` result.
 * View-only 403 is not an offline miss — the live GET still runs.
 * A dropped refresh must not skip that live GET either.
 */
export function classifyPackRefresh(input: {
  httpOk: boolean;
  status: number;
  hasPack: boolean;
}): "accept" | "view-only" | "miss" | "reject" {
  if (input.status === 403) return "view-only";
  if (input.httpOk && input.hasPack) return "accept";
  if (isOfflineFetchFailure({ ok: input.httpOk, status: input.status })) {
    return "miss";
  }
  return "reject";
}
