/**
 * Browser IndexedDB + Cache Storage adapter for day's pack snapshots.
 * Live Procore / room_packs reads never go through this store.
 */

import {
  buildOfflinePackSnapshot,
  isOfflineSnapshotExpired,
  OFFLINE_PDF_CACHE,
  offlinePackLatestKey,
  pickValidOfflineSnapshot,
  shouldWriteOfflineSnapshot,
  type OfflinePackLookup,
  type OfflinePackSnapshot,
} from "./offlinePackCache.ts";
import type { RoomPack } from "./pack.ts";
import { isPdfMagic } from "./sheetPdfUrl.ts";

const DB_NAME = "gcfieldlog-offline-packs";
const DB_VERSION = 1;
const STORE = "snapshots";

type SnapshotRow = {
  key: string;
  latestKey: string;
  requestId: string;
  snapshot: OfflinePackSnapshot;
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
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("requestId", "requestId", { unique: false });
        store.createIndex("latestKey", "latestKey", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB open failed"));
  });
}

function storeTx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("indexedDB request failed"));
  });
}

const memory = new Map<string, SnapshotRow>();

async function putRow(row: SnapshotRow): Promise<void> {
  if (!hasIndexedDb()) {
    memory.set(row.key, row);
    return;
  }
  const db = await openDb();
  try {
    await requestToPromise(storeTx(db, "readwrite").put(row));
  } finally {
    db.close();
  }
}

async function getRow(key: string): Promise<SnapshotRow | undefined> {
  if (!hasIndexedDb()) return memory.get(key);
  const db = await openDb();
  try {
    const row = await requestToPromise(storeTx(db, "readonly").get(key));
    return row as SnapshotRow | undefined;
  } finally {
    db.close();
  }
}

async function getAllRows(): Promise<SnapshotRow[]> {
  if (!hasIndexedDb()) return [...memory.values()];
  const db = await openDb();
  try {
    const rows = await requestToPromise(storeTx(db, "readonly").getAll());
    return (rows ?? []) as SnapshotRow[];
  } finally {
    db.close();
  }
}

async function deleteRow(key: string): Promise<void> {
  if (!hasIndexedDb()) {
    memory.delete(key);
    return;
  }
  const db = await openDb();
  try {
    await requestToPromise(storeTx(db, "readwrite").delete(key));
  } finally {
    db.close();
  }
}

export function pdfCacheRequest(src: string, origin?: string): Request {
  const base =
    origin ??
    (typeof location !== "undefined" ? location.origin : "http://localhost");
  return new Request(new URL(src, base).href, { credentials: "same-origin" });
}

export async function matchCachedPdf(
  src: string,
): Promise<Response | undefined> {
  if (!src || !hasCaches()) return undefined;
  try {
    const cache = await caches.open(OFFLINE_PDF_CACHE);
    return (
      (await cache.match(pdfCacheRequest(src))) ?? (await cache.match(src))
    );
  } catch {
    return undefined;
  }
}

export async function putPdfBytes(
  src: string,
  bytes: Uint8Array,
): Promise<void> {
  if (!src || !hasCaches() || !isPdfMagic(bytes)) return;
  try {
    const cache = await caches.open(OFFLINE_PDF_CACHE);
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const response = new Response(copy, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "X-GCFieldLog-Offline": "1",
      },
    });
    await cache.put(pdfCacheRequest(src), response);
  } catch {
    // Quota or private mode — pack JSON snapshot can still load RFIs.
  }
}

async function prefetchBlobRefs(
  snapshot: OfflinePackSnapshot,
): Promise<void> {
  if (!hasCaches()) return;
  for (const ref of snapshot.blobRefs) {
    try {
      const existing = await matchCachedPdf(ref.src);
      if (existing?.ok) continue;
      const fresh = await fetch(ref.src, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!fresh.ok) continue;
      const bytes = new Uint8Array(await fresh.arrayBuffer());
      await putPdfBytes(ref.src, bytes);
    } catch {
      // Sheet viewer will retry from Cache Storage on demand.
    }
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
}): Promise<OfflinePackSnapshot | null> {
  if (!shouldWriteOfflineSnapshot({ pack: input.pack, gotLivePack: true })) {
    return null;
  }
  const snapshot = buildOfflinePackSnapshot(input);
  const row = rowFromSnapshot(snapshot);
  await putRow(row);
  await putRow({ ...row, key: snapshot.latestKey });
  void pruneExpiredOfflinePacks();
  void prefetchBlobRefs(snapshot);
  return snapshot;
}

export async function readOfflinePack(
  lookup: OfflinePackLookup,
  now: Date | string | number = new Date(),
): Promise<OfflinePackSnapshot | null> {
  const latest = await getRow(offlinePackLatestKey(lookup));
  if (latest?.snapshot && !isOfflineSnapshotExpired(latest.snapshot, now)) {
    return latest.snapshot;
  }
  const rows = await getAllRows();
  return pickValidOfflineSnapshot(
    rows.map((row) => row.snapshot),
    lookup,
    now,
  );
}

export async function pruneExpiredOfflinePacks(
  now: Date | string | number = new Date(),
): Promise<number> {
  const rows = await getAllRows();
  let removed = 0;
  for (const row of rows) {
    if (isOfflineSnapshotExpired(row.snapshot, now)) {
      await deleteRow(row.key);
      removed += 1;
    }
  }
  return removed;
}
