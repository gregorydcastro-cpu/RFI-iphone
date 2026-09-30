/* GC Field Log offline worker — sheet PDFs only.
 *
 * Network-first for GET /api/sheet-pdf and same-origin /packs/*.pdf.
 * Does not intercept /api/room-pack/* : live pack JSON stays no-store,
 * and the day's snapshot lives in IndexedDB (lib/offlinePackStore.ts).
 *
 * A good cached PDF is returned only when the live fetch fails, marked
 * X-GCFieldLog-Offline: 1. A truncated or non-PDF body never replaces
 * that copy. cache.put is awaited and keyed by URL so a no-store request
 * (browsers reject those as cache keys) still lands before the worker dies.
 */
const PDF_CACHE = "gcfieldlog-offline-pdfs-v1";
const OFFLINE_HEADER = "X-GCFieldLog-Offline";

function isSheetPdfUrl(url, origin) {
  try {
    const parsed = new URL(url);
    if (origin && parsed.origin !== origin) return false;
    if (parsed.pathname === "/api/sheet-pdf") return true;
    return (
      parsed.pathname.startsWith("/packs/") && parsed.pathname.endsWith(".pdf")
    );
  } catch {
    return false;
  }
}

function cacheKeyFor(url) {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.href;
}

function isPdfMagic(bytes) {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

function pdfBytesAreCacheable(bytes, headers) {
  if (!isPdfMagic(bytes)) return false;
  const type = (headers.get("content-type") || "").toLowerCase();
  if (type.includes("html") || type.includes("json")) return false;
  const encoding = (headers.get("content-encoding") || "").trim().toLowerCase();
  if (encoding && encoding !== "identity") return true;
  const contentLength = headers.get("content-length");
  if (!contentLength) return true;
  const length = Number(String(contentLength).trim());
  if (!Number.isFinite(length) || length < 0) return true;
  return bytes.byteLength >= length;
}

function isQuotaExceededError(error) {
  const name = error && error.name ? String(error.name) : "";
  if (name === "QuotaExceededError") return true;
  const message = error && error.message ? String(error.message) : "";
  return /quota/i.test(message);
}

function staleOfflinePdfCacheNames(names) {
  return names.filter(
    (name) => name.startsWith("gcfieldlog-offline-pdfs-") && name !== PDF_CACHE,
  );
}

function pdfResponse(bytes) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(copy, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(copy.byteLength),
    },
  });
}

async function matchPdf(cachesImpl, cacheKey) {
  const cache = await cachesImpl.open(PDF_CACHE);
  return (await cache.match(cacheKey)) || null;
}

async function putValidatedPdf(cachesImpl, cacheKey, bytes) {
  const cache = await cachesImpl.open(PDF_CACHE);
  try {
    await cache.put(cacheKey, pdfResponse(bytes));
    return;
  } catch (error) {
    if (!isQuotaExceededError(error)) return;
  }
  try {
    const keys = await cache.keys();
    const victim = keys.find((key) => key.url !== cacheKey);
    if (victim) await cache.delete(victim);
    await cache.put(cacheKey, pdfResponse(bytes));
  } catch {
    // The page's putPdfBytes retries after dropping yesterday's packs.
  }
}

async function offlineResponse(cached) {
  const headers = new Headers(cached.headers);
  headers.set(OFFLINE_HEADER, "1");
  if (!headers.get("Content-Type")) headers.set("Content-Type", "application/pdf");
  const body = await cached.blob();
  headers.set("Content-Length", String(body.size));
  return new Response(body, { status: 200, headers });
}

async function handlePdfFetch(request, deps) {
  const fetchImpl = deps.fetchImpl;
  const cachesImpl = deps.cachesImpl;
  const cacheKey = cacheKeyFor(request.url);
  let fresh;
  try {
    fresh = await fetchImpl(request);
  } catch (error) {
    const cached = await matchPdf(cachesImpl, cacheKey);
    if (cached) return offlineResponse(cached);
    throw error;
  }

  let bytes = null;
  if (fresh && fresh.ok) {
    try {
      bytes = new Uint8Array(await fresh.clone().arrayBuffer());
    } catch {
      bytes = null;
    }
  }

  if (bytes && pdfBytesAreCacheable(bytes, fresh.headers)) {
    await putValidatedPdf(cachesImpl, cacheKey, bytes);
    return fresh;
  }

  if (fresh && fresh.ok) return fresh;

  const cached = await matchPdf(cachesImpl, cacheKey);
  if (cached) return offlineResponse(cached);
  return fresh;
}

function installOfflinePackServiceWorker(scope) {
  scope.addEventListener("install", (event) => {
    event.waitUntil(scope.skipWaiting());
  });

  scope.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          staleOfflinePdfCacheNames(names).map((name) => caches.delete(name)),
        );
        await scope.clients.claim();
      })(),
    );
  });

  scope.addEventListener("message", (event) => {
    const data = event.data;
    if (data && data.type === "SKIP_WAITING") scope.skipWaiting();
  });

  scope.addEventListener("fetch", (event) => {
    const request = event.request;
    if (!request || request.method !== "GET") return;
    const origin = scope.location && scope.location.origin;
    if (!isSheetPdfUrl(request.url, origin)) return;
    event.respondWith(
      handlePdfFetch(request, {
        fetchImpl: (input) => fetch(input),
        cachesImpl: caches,
      }),
    );
  });
}

if (typeof self !== "undefined" && self && typeof self.addEventListener === "function") {
  self.__offlinePackSw = {
    isSheetPdfUrl,
    pdfBytesAreCacheable,
    staleOfflinePdfCacheNames,
    cacheKeyFor,
    handlePdfFetch,
  };
  installOfflinePackServiceWorker(self);
}
