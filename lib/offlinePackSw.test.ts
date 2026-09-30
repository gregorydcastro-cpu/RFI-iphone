import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import {
  pdfBytesAreCacheable,
  staleOfflinePdfCacheNames,
} from "./offlinePackCache.ts";

const SOURCE_URL = new URL("../public/offline-pack-sw.js", import.meta.url);
const source = readFileSync(SOURCE_URL, "utf8");

type SwApi = {
  isSheetPdfUrl: (url: string, origin: string) => boolean;
  pdfBytesAreCacheable: (
    bytes: Uint8Array,
    headers: Headers,
  ) => boolean;
  staleOfflinePdfCacheNames: (names: string[]) => string[];
  cacheKeyFor: (url: string) => string;
  handlePdfFetch: (
    request: { url: string; method?: string },
    deps: {
      fetchImpl: (request: { url: string }) => Promise<Response>;
      cachesImpl: {
        open: (name: string) => Promise<{
          match: (key: string) => Promise<Response | undefined>;
          put: (key: string, response: Response) => Promise<void>;
          delete: (key: Request | string) => Promise<boolean>;
          keys: () => Promise<Array<{ url: string }>>;
        }>;
      };
    },
  ) => Promise<Response>;
};

function loadSw(): SwApi {
  const self = {
    addEventListener() {},
    location: { origin: "https://www.gcfieldlog.com" },
    skipWaiting() {},
    clients: { claim: async () => {} },
  };
  const context = {
    self,
    URL,
    Response,
    Headers,
    Request,
    Uint8Array,
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const api = (self as { __offlinePackSw?: SwApi }).__offlinePackSw;
  if (!api) throw new Error("service worker did not expose its test api");
  return api;
}

const sw = loadSw();
const ORIGIN = "https://www.gcfieldlog.com";

function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.7\nMaple Point sheet\n%%EOF");
}

function pdfResponse(bytes: Uint8Array, status = 200): Response {
  return new Response(bytes, {
    status,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
    },
  });
}

function createCaches(options?: { quotaFailures?: number }) {
  const bucket = new Map<string, Uint8Array>();
  let quotaFailures = options?.quotaFailures ?? 0;
  return {
    bucket,
    async open() {
      return {
        async match(key: string) {
          const hit = bucket.get(key);
          if (!hit) return undefined;
          const copy = new Uint8Array(hit.byteLength);
          copy.set(hit);
          return new Response(copy, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Length": String(copy.byteLength),
            },
          });
        },
        async put(key: string, response: Response) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (quotaFailures > 0) {
            quotaFailures -= 1;
            const error = new Error("quota exceeded");
            error.name = "QuotaExceededError";
            throw error;
          }
          bucket.set(key, bytes);
        },
        async delete(key: Request | string) {
          const url = typeof key === "string" ? key : key.url;
          return bucket.delete(url);
        },
        async keys() {
          return [...bucket.keys()].map((url) => ({ url }));
        },
      };
    },
  };
}

test("worker source awaits the cache write and stays off pack JSON", () => {
  assert.equal(source.includes("void cache.put"), false);
  assert.equal(source.includes("await cache.put"), true);
  assert.match(source, /\/api\/room-pack/);
  assert.equal(
    sw.isSheetPdfUrl(`${ORIGIN}/api/room-pack/live?requestId=maple-point-733`, ORIGIN),
    false,
  );
  assert.equal(sw.isSheetPdfUrl(`${ORIGIN}/api/room-pack/refresh`, ORIGIN), false);
  assert.equal(
    sw.isSheetPdfUrl(
      `${ORIGIN}/api/sheet-pdf?requestId=maple-point-733&sheetId=A-101`,
      ORIGIN,
    ),
    true,
  );
  assert.equal(
    sw.isSheetPdfUrl(`${ORIGIN}/packs/maple-point-a101.pdf`, ORIGIN),
    true,
  );
  assert.equal(
    sw.isSheetPdfUrl("https://evil.example/api/sheet-pdf?requestId=x&sheetId=y", ORIGIN),
    false,
  );
  assert.equal(
    sw.isSheetPdfUrl(`${ORIGIN}/packs/notes.txt`, ORIGIN),
    false,
  );
  assert.equal(
    sw.cacheKeyFor(`${ORIGIN}/packs/maple-point-a101.pdf#page=2`),
    `${ORIGIN}/packs/maple-point-a101.pdf`,
  );
});

test("worker and page agree on which PDF bodies are cacheable", () => {
  const pdf = pdfBytes();
  const samples: Array<{ bytes: Uint8Array; headers: Headers }> = [
    { bytes: pdf, headers: new Headers({ "content-type": "application/pdf" }) },
    {
      bytes: pdf.slice(0, 8),
      headers: new Headers({
        "content-type": "application/pdf",
        "content-length": "8000",
      }),
    },
    {
      bytes: new TextEncoder().encode("<html>no</html>"),
      headers: new Headers({ "content-type": "text/html" }),
    },
    {
      bytes: pdf,
      headers: new Headers({ "content-type": "application/json" }),
    },
  ];
  for (const sample of samples) {
    assert.equal(
      sw.pdfBytesAreCacheable(sample.bytes, sample.headers),
      pdfBytesAreCacheable(sample.bytes, sample.headers),
    );
  }
  assert.deepEqual(
    sw.staleOfflinePdfCacheNames([
      "gcfieldlog-offline-pdfs-v1",
      "gcfieldlog-offline-pdfs-v0",
      "app-shell",
    ]),
    staleOfflinePdfCacheNames([
      "gcfieldlog-offline-pdfs-v1",
      "gcfieldlog-offline-pdfs-v0",
      "app-shell",
    ]),
  );
});

test("a bad live body does not replace a cached sheet", async () => {
  const cachesImpl = createCaches();
  const url = `${ORIGIN}/api/sheet-pdf?requestId=maple-point-733&sheetId=A-101`;
  const good = pdfBytes();
  cachesImpl.bucket.set(url, good);
  const html = new TextEncoder().encode("<html>gateway</html>");
  const fresh = await sw.handlePdfFetch(
    { url, method: "GET" },
    {
      cachesImpl,
      fetchImpl: async () =>
        new Response(html, {
          status: 200,
          headers: {
            "Content-Type": "text/html",
            "Content-Length": String(html.byteLength),
          },
        }),
    },
  );
  assert.equal(fresh.headers.get("X-GCFieldLog-Offline"), null);
  assert.equal(cachesImpl.bucket.get(url)?.byteLength, good.byteLength);
  const offline = await sw.handlePdfFetch(
    { url, method: "GET" },
    {
      cachesImpl,
      fetchImpl: async () => {
        throw new Error("offline");
      },
    },
  );
  assert.equal(offline.headers.get("X-GCFieldLog-Offline"), "1");
  const bytes = new Uint8Array(await offline.arrayBuffer());
  assert.equal(bytes.byteLength, good.byteLength);
  assert.equal(bytes[0], 0x25);
});

test("network-first stores a complete PDF and serves it when the radio drops", async () => {
  const cachesImpl = createCaches();
  const url = `${ORIGIN}/packs/maple-point-a101.pdf`;
  const good = pdfBytes();
  const live = await sw.handlePdfFetch(
    { url, method: "GET" },
    {
      cachesImpl,
      fetchImpl: async () => pdfResponse(good),
    },
  );
  assert.equal(live.headers.get("X-GCFieldLog-Offline"), null);
  assert.equal(cachesImpl.bucket.get(url)?.byteLength, good.byteLength);
  const failed = await sw.handlePdfFetch(
    { url, method: "GET" },
    {
      cachesImpl,
      fetchImpl: async () => new Response("down", { status: 502 }),
    },
  );
  assert.equal(failed.status, 200);
  assert.equal(failed.headers.get("X-GCFieldLog-Offline"), "1");
});

test("a short download does not clobber the cached sheet", async () => {
  const cachesImpl = createCaches();
  const url = `${ORIGIN}/packs/maple-point-a101.pdf`;
  const good = pdfBytes();
  cachesImpl.bucket.set(url, good);
  const cut = good.slice(0, 8);
  await sw.handlePdfFetch(
    { url, method: "GET" },
    {
      cachesImpl,
      fetchImpl: async () =>
        new Response(cut, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Length": "8000",
          },
        }),
    },
  );
  assert.equal(cachesImpl.bucket.get(url)?.byteLength, good.byteLength);
});

test("quota pressure evicts one other PDF and still stores the sheet", async () => {
  const cachesImpl = createCaches({ quotaFailures: 1 });
  const keep = `${ORIGIN}/packs/maple-point-old.pdf`;
  const url = `${ORIGIN}/packs/maple-point-a101.pdf`;
  cachesImpl.bucket.set(keep, pdfBytes());
  const good = pdfBytes();
  await sw.handlePdfFetch(
    { url, method: "GET" },
    {
      cachesImpl,
      fetchImpl: async () => pdfResponse(good),
    },
  );
  assert.equal(cachesImpl.bucket.get(url)?.byteLength, good.byteLength);
  assert.equal(cachesImpl.bucket.has(keep), false);
});

test("a miss with no cache still rejects", async () => {
  const cachesImpl = createCaches();
  await assert.rejects(
    sw.handlePdfFetch(
      { url: `${ORIGIN}/packs/maple-point-a101.pdf`, method: "GET" },
      {
        cachesImpl,
        fetchImpl: async () => {
          throw new Error("offline");
        },
      },
    ),
  );
});
