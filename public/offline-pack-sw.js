/* Minimal GC Field Log offline worker.
 * Network-first for sheet PDFs only. Never intercepts live pack JSON.
 */
const PDF_CACHE = "gcfieldlog-offline-pdfs-v1";

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
        if (fresh.ok) {
          const cache = await caches.open(PDF_CACHE);
          void cache.put(request, fresh.clone());
          return fresh;
        }
        const cached = await caches.match(request);
        return cached ?? fresh;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
