/* Minimal GC Field Log offline worker.
 * Network-first for sheet PDFs only. Never intercepts live pack JSON.
 * A failed live fetch with a cached PDF is returned as an offline copy
 * (X-GCFieldLog-Offline: 1) so the viewer can show the offline note.
 * With no cache, the failure reaches the viewer error banner and Retry.
 */
const PDF_CACHE = "gcfieldlog-offline-pdfs-v1";
const OFFLINE_HEADER = "X-GCFieldLog-Offline";

function isPdfPath(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname === "/api/sheet-pdf") return true;
    return (
      parsed.pathname.startsWith("/packs/") && parsed.pathname.endsWith(".pdf")
    );
  } catch {
    return false;
  }
}

function shouldStore(response) {
  if (!response.ok) return false;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  return type.includes("pdf") || type.includes("octet-stream");
}

async function offlineResponse(cached) {
  const headers = new Headers(cached.headers);
  headers.set(OFFLINE_HEADER, "1");
  const body = await cached.blob();
  return new Response(body, { status: 200, headers });
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  if (!isPdfPath(request.url)) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        if (shouldStore(fresh)) {
          const cache = await caches.open(PDF_CACHE);
          void cache.put(request, fresh.clone());
          return fresh;
        }
        if (fresh.ok) return fresh;
        const cached = await caches.match(request);
        if (cached) return offlineResponse(cached);
        return fresh;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return offlineResponse(cached);
        throw err;
      }
    })(),
  );
});
