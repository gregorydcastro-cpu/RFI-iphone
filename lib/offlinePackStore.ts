/**
 * Browser IndexedDB + Cache Storage adapter for day's pack snapshots.
 * Live Procore / room_packs reads never go through this store.
 *
 * PDF bytes have one cache (`gcfieldlog-offline-pdfs-v1`), shared with
 * `/offline-pack-sw.js`. This module is the writer that checks PDF magic.
 * The worker is network-first and must not replace a good copy with a
 * truncated or non-PDF body.
 */

import {
  absolutePdfCacheUrl,
  buildOfflinePackSnapshot,
  isOfflineSnapshotExpired,
  isQuotaExceededError,
  OFFLINE_PACK_SCHEMA,
  OFFLINE_PDF_CACHE,
  offlinePackLatestKey,
  pdfBytesAreCacheable,
  pdfCacheUrlsToDrop,
  pickValidOfflineSnapshot,
  shouldWriteOfflineSnapshot,
  snapshotMatchesLookup,
  type OfflinePackLookup,
  type OfflinePackSnapshot,
} from "./offlinePackCache.ts";
import type { RoomPack } from "./pack.ts";
import { isPdfMagic } from "./sheetPdfUrl.ts";

const DB_NAME = "gcfieldlog-offline-packs";
const DB_VERSION = 1;
const STORE = "snapshots";
const IDB_OPEN_TIMEOUT_MS = 4000;

/** One hung sheet must not block the rest of the day's pack. */
export const PDF_PREFETCH_ATTEMPTS = 2;
export const PDF_PREFETCH_CONCURRENCY = 2;
export const PDF_PREFETCH_TIMEOUT_MS = 20_000;

type SnapshotRow = {
  key: string;
  latestKey: string;
  requestId: string;
  snapshot: OfflinePackSnapshot;
};

type PrefetchOptions = {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  attempts?: number;
  concurrency?: number;
  origin?: string;
};

export type PrefetchPdfResult = {
  stored: string[];
  missed: string[];
  skipped: string[];
};

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

function hasCaches(): boolean {
  return typeof caches !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("indexedDB open timed out"));
    }, IDB_OPEN_TIMEOUT_MS);
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("requestId", "requestId", { unique: false });
        store.createIndex("latestKey", "latestKey", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
      };
      if (settled) {
        db.close();
        return;
      }
      finish(() => resolve(db));
    };
    request.onerror = () => {
      finish(() =>
        reject(request.error ?? new Error("indexedDB open failed")),
      );
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () =>
      reject(tx.error ?? new Error("indexedDB transaction aborted"));
    tx.onerror = () =>
      reject(tx.error ?? new Error("indexedDB transaction failed"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB request failed"));
  });
}

const memory = new Map<string, SnapshotRow>();

/** In-memory fallback only. IndexedDB rows are untouched. */
export function clearOfflinePackMemoryForTests(): void {
  memory.clear();
}

async function putRows(rows: SnapshotRow[]): Promise<void> {
  if (rows.length === 0) return;
  if (!hasIndexedDb()) {
    for (const row of rows) memory.set(row.key, row);
    return;
  }
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const row of rows) store.put(row);
    await txDone(tx);
  } finally {
    db.close();
  }
}

async function getRow(key: string): Promise<SnapshotRow | undefined> {
  if (!hasIndexedDb()) return memory.get(key);
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const row = await requestToPromise<SnapshotRow | undefined>(
      tx.objectStore(STORE).get(key),
    );
    await txDone(tx);
    return row;
  } finally {
    db.close();
  }
}

async function getAllRows(): Promise<SnapshotRow[]> {
  if (!hasIndexedDb()) return [...memory.values()];
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readonly");
    const rows = await requestToPromise<SnapshotRow[]>(
      tx.objectStore(STORE).getAll(),
    );
    await txDone(tx);
    return rows ?? [];
  } finally {
    db.close();
  }
}

async function deleteRows(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  if (!hasIndexedDb()) {
    for (const key of keys) memory.delete(key);
    return;
  }
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const key of keys) store.delete(key);
    await txDone(tx);
  } finally {
    db.close();
  }
}

export function pdfCacheRequest(src: string, origin?: string): Request {
  return new Request(absolutePdfCacheUrl(src, origin));
}

async function openPdfCache(): Promise<Cache | null> {
  if (!hasCaches()) return null;
  try {
    return await caches.open(OFFLINE_PDF_CACHE);
  } catch {
    return null;
  }
}

export async function matchCachedPdf(
  src: string,
): Promise<Response | undefined> {
  if (!src) return undefined;
  const cache = await openPdfCache();
  if (!cache) return undefined;
  try {
    const absolute = absolutePdfCacheUrl(src);
    return (
      (await cache.match(absolute)) ??
      (await cache.match(pdfCacheRequest(src))) ??
      (await cache.match(src))
    );
  } catch {
    return undefined;
  }
}

export async function deleteCachedPdf(src: string): Promise<void> {
  if (!src) return;
  const cache = await openPdfCache();
  if (!cache) return;
  try {
    const absolute = absolutePdfCacheUrl(src);
    await cache.delete(absolute);
    await cache.delete(src);
    await cache.delete(pdfCacheRequest(src));
  } catch {
    // Best-effort. A later good put overwrites the same key.
  }
}

function pdfResponse(bytes: Uint8Array): Response {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(copy, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(copy.byteLength),
      "X-GCFieldLog-Offline": "1",
    },
  });
}

async function writePdf(
  cache: Cache,
  src: string,
  bytes: Uint8Array,
): Promise<void> {
  await cache.put(absolutePdfCacheUrl(src), pdfResponse(bytes));
}

async function evictOneOtherPdf(cache: Cache, src: string): Promise<boolean> {
  const target = absolutePdfCacheUrl(src);
  const keys = await cache.keys();
  const victim = keys.find((key) => key.url !== target);
  if (!victim) return false;
  await cache.delete(victim);
  return true;
}

export async function putPdfBytes(
  src: string,
  bytes: Uint8Array,
): Promise<void> {
  if (!src || !hasCaches() || !pdfBytesAreCacheable(bytes)) return;
  const cache = await openPdfCache();
  if (!cache) return;
  try {
    await writePdf(cache, src, bytes);
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) return;
  }
  try {
    await pruneExpiredOfflinePacks();
  } catch {
    // Still try to write. Eviction below is the second chance.
  }
  try {
    await writePdf(cache, src, bytes);
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) return;
  }
  try {
    await evictOneOtherPdf(cache, src);
    await writePdf(cache, src, bytes);
  } catch {
    // Quota or private mode — pack JSON snapshot can still load RFIs.
  }
}

async function cachedPdfUsable(src: string): Promise<boolean> {
  const cached = await matchCachedPdf(src);
  if (!cached?.ok) return false;
  try {
    const blob = await cached.blob();
    if (blob.size < 5) {
      await deleteCachedPdf(src);
      return false;
    }
    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if (!isPdfMagic(head)) {
      await deleteCachedPdf(src);
      return false;
    }
    return true;
  } catch {
    await deleteCachedPdf(src);
    return false;
  }
}

function shouldRetryPrefetch(
  status: number | null,
  attempt: number,
  attempts: number,
): boolean {
  if (attempt >= attempts - 1) return false;
  if (status === null || status === 408 || status === 429) return true;
  return status >= 500;
}

function abortAfter(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

async function fetchPdfForCache(
  src: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; status: number | null }> {
  const timeout = abortAfter(timeoutMs);
  try {
    const response = await fetchImpl(src, {
      credentials: "same-origin",
      cache: "no-store",
      signal: timeout.signal,
    });
    if (!response.ok) return { ok: false, status: response.status };
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!pdfBytesAreCacheable(bytes, response.headers)) {
      return { ok: false, status: response.status };
    }
    return { ok: true, bytes };
  } catch {
    return { ok: false, status: null };
  } finally {
    timeout.cancel();
  }
}

const inflightPrefetch = new Map<
  string,
  Promise<"stored" | "skipped" | "missed">
>();

async function storeOnePdf(
  src: string,
  options: Required<Pick<PrefetchOptions, "fetchImpl" | "timeoutMs" | "attempts">> &
    Pick<PrefetchOptions, "origin">,
): Promise<"stored" | "skipped" | "missed"> {
  const key = absolutePdfCacheUrl(src, options.origin);
  const existing = inflightPrefetch.get(key);
  if (existing) return existing;
  const run = (async () => {
    if (await cachedPdfUsable(src)) return "skipped" as const;
    for (let attempt = 0; attempt < options.attempts; attempt++) {
      const fetched = await fetchPdfForCache(
        src,
        options.fetchImpl,
        options.timeoutMs,
      );
      if (fetched.ok) {
        await putPdfBytes(src, fetched.bytes);
        return (await matchCachedPdf(src))?.ok === true
          ? ("stored" as const)
          : ("missed" as const);
      }
      if (!shouldRetryPrefetch(fetched.status, attempt, options.attempts)) {
        return "missed" as const;
      }
    }
    return "missed" as const;
  })().finally(() => {
    if (inflightPrefetch.get(key) === run) inflightPrefetch.delete(key);
  });
  inflightPrefetch.set(key, run);
  return run;
}

async function runPool(
  tasks: Array<() => Promise<void>>,
  concurrency: number,
): Promise<void> {
  if (tasks.length === 0) return;
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    async () => {
      while (cursor < tasks.length) {
        const index = cursor;
        cursor += 1;
        const task = tasks[index];
        if (task) await task();
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Download the day's sheet PDFs into Cache Storage.
 * A stalled sheet times out and is retried once; other sheets keep going.
 * In-flight URLs are shared so a second pass does not double-download.
 */
export async function prefetchOfflinePackPdfs(
  refs: Array<{ src: string }>,
  options?: PrefetchOptions,
): Promise<PrefetchPdfResult> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? PDF_PREFETCH_TIMEOUT_MS;
  const attempts = options?.attempts ?? PDF_PREFETCH_ATTEMPTS;
  const concurrency = options?.concurrency ?? PDF_PREFETCH_CONCURRENCY;
  const stored: string[] = [];
  const missed: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  const tasks: Array<() => Promise<void>> = [];
  for (const ref of refs) {
    if (!ref.src || seen.has(ref.src)) continue;
    seen.add(ref.src);
    tasks.push(async () => {
      const outcome = await storeOnePdf(ref.src, {
        fetchImpl,
        timeoutMs,
        attempts,
        origin: options?.origin,
      });
      if (outcome === "stored") stored.push(ref.src);
      else if (outcome === "skipped") skipped.push(ref.src);
      else missed.push(ref.src);
    });
  }
  await runPool(tasks, concurrency);
  return { stored, missed, skipped };
}

async function deleteUnreferencedPdfs(
  keep: Set<string>,
  origin?: string,
): Promise<void> {
  const cache = await openPdfCache();
  if (!cache) return;
  try {
    const keys = await cache.keys();
    const drop = pdfCacheUrlsToDrop(
      keys.map((key) => key.url),
      [...keep],
      origin,
    );
    await Promise.all(drop.map((url) => cache.delete(url)));
  } catch {
    // Cache listing can fail in private mode. Snapshots are still pruned.
  }
}

function rowFromSnapshot(snapshot: OfflinePackSnapshot): SnapshotRow {
  return {
    key: snapshot.cacheKey,
    latestKey: snapshot.latestKey,
    requestId: snapshot.requestId,
    snapshot,
  };
}

export async function rememberOfflinePack(input: {
  pack: RoomPack;
  requestId?: string;
  projectId?: string;
  roomId?: string;
  cachedAt?: string;
  now?: Date | string | number;
  prefetch?: boolean;
}): Promise<OfflinePackSnapshot | null> {
  if (!shouldWriteOfflineSnapshot({ pack: input.pack, gotLivePack: true })) {
    return null;
  }
  const snapshot = buildOfflinePackSnapshot(input);
  const row = rowFromSnapshot(snapshot);
  await putRows([row, { ...row, key: snapshot.latestKey }]);
  try {
    await pruneExpiredOfflinePacks(input.now ?? new Date());
  } catch {
    // The new snapshot is already committed. Eviction can retry on the next open.
  }
  if (input.prefetch !== false) {
    void prefetchOfflinePackPdfs(snapshot.blobRefs).catch(() => {
      // Sheet viewer and the next open retry a missed PDF.
    });
  }
  return snapshot;
}

export async function readOfflinePack(
  lookup: OfflinePackLookup,
  now: Date | string | number = new Date(),
): Promise<OfflinePackSnapshot | null> {
  const latest = await getRow(offlinePackLatestKey(lookup));
  const latestSnap = latest?.snapshot;
  const freshLatest =
    latestSnap &&
    latestSnap.schema === OFFLINE_PACK_SCHEMA &&
    !isOfflineSnapshotExpired(latestSnap, now) &&
    snapshotMatchesLookup(latestSnap, lookup)
      ? latestSnap
      : null;
  let picked = freshLatest;
  if (!picked) {
    const rows = await getAllRows();
    picked = pickValidOfflineSnapshot(
      rows.map((row) => row.snapshot),
      lookup,
      now,
    );
  }
  try {
    await pruneExpiredOfflinePacks(now);
  } catch {
    // Returning the snapshot matters more than this cleanup pass.
  }
  return picked;
}

export async function pruneExpiredOfflinePacks(
  now: Date | string | number = new Date(),
): Promise<number> {
  const rows = await getAllRows();
  const expired: string[] = [];
  const keep = new Set<string>();
  for (const row of rows) {
    if (!row?.snapshot || isOfflineSnapshotExpired(row.snapshot, now)) {
      if (row?.key) expired.push(row.key);
      continue;
    }
    for (const ref of row.snapshot.blobRefs ?? []) {
      if (ref?.src) keep.add(absolutePdfCacheUrl(ref.src));
    }
  }
  await deleteRows(expired);
  await deleteUnreferencedPdfs(keep);
  return expired.length;
}
