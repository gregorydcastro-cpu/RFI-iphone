import assert from "node:assert/strict";
import { test } from "node:test";
import type { RoomPack } from "./pack.ts";
import { lookupFromPack } from "./offlinePackCache.ts";
import {
  clearOfflinePackMemoryForTests,
  deleteCachedPdf,
  matchCachedPdf,
  PDF_PREFETCH_ATTEMPTS,
  PDF_PREFETCH_CONCURRENCY,
  PDF_PREFETCH_TIMEOUT_MS,
  prefetchOfflinePackPdfs,
  putPdfBytes,
  readOfflinePack,
  rememberOfflinePack,
} from "./offlinePackStore.ts";

const NOW = "2026-09-21T18:00:00.000Z";
const YESTERDAY = "2026-09-20T15:00:00.000Z";

const maplePack: RoomPack = {
  schema: "gcpullog.room_pack.v1",
  status: "ready",
  request_id: "maple-point-733",
  pulled_at: "2026-09-21T14:00:00.000Z",
  revision_stamp: { drawing: "A-101", rev: "A" },
  project: {
    id: "proj-maple-point",
    name: "Maple Point Medical Office",
    slug: "maple-point",
  },
  room: { id: "room-733", name: "Room 733", number: "733" },
  sheets: [
    {
      id: "A-101",
      rev: "A",
      pdf: "/packs/maple-point-a101.pdf",
      title: "Level 1 Floor Plan",
      discipline: "architectural",
    },
    {
      id: "E-101",
      rev: "B",
      pdf: "/packs/maple-point-e101.pdf",
      discipline: "electrical",
    },
  ],
  rfis: [],
  layout: { sheet: "A-101" },
  actions: [],
};

function pdfBytes(note = "maple"): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.7\n${note}\n%%EOF`);
}

function cacheUrl(input: RequestInfo): string {
  if (typeof input === "string") return new URL(input, "http://localhost").href;
  return input.url;
}

function createFakeCaches(options?: { quotaFailures?: number }) {
  const bucket = new Map<string, Uint8Array>();
  let quotaFailures = options?.quotaFailures ?? 0;
  const api = {
    async open() {
      return {
        async match(input: RequestInfo) {
          const hit = bucket.get(cacheUrl(input));
          if (!hit) return undefined;
          const copy = new Uint8Array(hit.byteLength);
          copy.set(hit);
          return new Response(copy, {
            status: 200,
            headers: { "Content-Type": "application/pdf" },
          });
        },
        async put(input: RequestInfo, response: Response) {
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (quotaFailures > 0) {
            quotaFailures -= 1;
            const error = new Error("quota exceeded");
            error.name = "QuotaExceededError";
            throw error;
          }
          bucket.set(cacheUrl(input), bytes);
        },
        async delete(input: RequestInfo) {
          return bucket.delete(cacheUrl(input));
        },
        async keys() {
          return [...bucket.keys()].map((url) => new Request(url));
        },
      };
    },
  };
  return {
    api,
    bucket,
    seed(url: string, bytes: Uint8Array) {
      bucket.set(new URL(url, "http://localhost").href, bytes);
    },
  };
}

function useCaches(fake: ReturnType<typeof createFakeCaches>) {
  clearOfflinePackMemoryForTests();
  const previous = globalThis.caches;
  globalThis.caches = fake.api as unknown as CacheStorage;
  return () => {
    globalThis.caches = previous;
    clearOfflinePackMemoryForTests();
  };
}

test("prefetch retries a dropped sheet and does not block the rest", () => {
  assert.equal(PDF_PREFETCH_ATTEMPTS, 2);
  assert.equal(PDF_PREFETCH_CONCURRENCY, 2);
  assert.equal(PDF_PREFETCH_TIMEOUT_MS >= 5_000, true);
});

test("today's snapshot keeps its pdf and drops an orphan", async () => {
  const fake = createFakeCaches();
  const restore = useCaches(fake);
  try {
    await putPdfBytes("/packs/maple-point-a101.pdf", pdfBytes("floor"));
    await putPdfBytes("/packs/orphan.pdf", pdfBytes("orphan"));
    const snapshot = await rememberOfflinePack({
      pack: maplePack,
      cachedAt: NOW,
      now: NOW,
      prefetch: false,
    });
    assert.ok(snapshot);
    const read = await readOfflinePack(lookupFromPack(maplePack), NOW);
    assert.equal(read?.requestId, "maple-point-733");
    const kept = await matchCachedPdf("/packs/maple-point-a101.pdf");
    assert.equal(kept?.ok, true);
    assert.equal(await matchCachedPdf("/packs/orphan.pdf"), undefined);
    const other = await readOfflinePack(
      { ...lookupFromPack(maplePack), projectId: "other-job" },
      NOW,
    );
    assert.equal(other, null);
  } finally {
    restore();
  }
});

test("yesterday's snapshot and its pdf are gone after the day boundary", async () => {
  const fake = createFakeCaches();
  const restore = useCaches(fake);
  try {
    await putPdfBytes("/packs/maple-point-a101.pdf", pdfBytes("floor"));
    await putPdfBytes("/packs/maple-point-e101.pdf", pdfBytes("power"));
    await rememberOfflinePack({
      pack: maplePack,
      cachedAt: YESTERDAY,
      now: NOW,
      prefetch: false,
    });
    assert.equal(
      await readOfflinePack(lookupFromPack(maplePack), NOW),
      null,
    );
    assert.equal(await matchCachedPdf("/packs/maple-point-a101.pdf"), undefined);
    assert.equal(await matchCachedPdf("/packs/maple-point-e101.pdf"), undefined);
  } finally {
    restore();
  }
});

test("quota failure drops an unreferenced pdf and stores the new sheet", async () => {
  const fake = createFakeCaches({ quotaFailures: 1 });
  const restore = useCaches(fake);
  try {
    fake.seed("/packs/orphan.pdf", pdfBytes("orphan"));
    await putPdfBytes("/packs/maple-point-a101.pdf", pdfBytes("floor"));
    const cached = await matchCachedPdf("/packs/maple-point-a101.pdf");
    assert.equal(cached?.ok, true);
    assert.equal(await matchCachedPdf("/packs/orphan.pdf"), undefined);
  } finally {
    restore();
  }
});

test("quota failure evicts one other sheet when yesterday's packs are already gone", async () => {
  const fake = createFakeCaches({ quotaFailures: 2 });
  const restore = useCaches(fake);
  try {
    fake.seed("/packs/maple-point-a101.pdf", pdfBytes("floor"));
    await rememberOfflinePack({
      pack: maplePack,
      cachedAt: NOW,
      now: NOW,
      prefetch: false,
    });
    await putPdfBytes("/packs/maple-point-extra.pdf", pdfBytes("extra"));
    assert.equal(
      (await matchCachedPdf("/packs/maple-point-extra.pdf"))?.ok,
      true,
    );
    assert.equal(await matchCachedPdf("/packs/maple-point-a101.pdf"), undefined);
  } finally {
    restore();
  }
});

test("corrupt cache entry is replaced; a good one is not downloaded again", async () => {
  const fake = createFakeCaches();
  const restore = useCaches(fake);
  try {
    fake.seed(
      "/packs/maple-point-a101.pdf",
      new TextEncoder().encode("<html>no sheet</html>"),
    );
    let calls = 0;
    const first = await prefetchOfflinePackPdfs(
      [{ src: "/packs/maple-point-a101.pdf" }],
      {
        attempts: 1,
        concurrency: 1,
        timeoutMs: 1000,
        fetchImpl: async () => {
          calls += 1;
          const bytes = pdfBytes("floor");
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Length": String(bytes.byteLength),
            },
          });
        },
      },
    );
    assert.equal(calls, 1);
    assert.deepEqual(first.stored, ["/packs/maple-point-a101.pdf"]);
    const again = await prefetchOfflinePackPdfs(
      [{ src: "/packs/maple-point-a101.pdf" }],
      {
        attempts: 1,
        concurrency: 1,
        fetchImpl: async () => {
          calls += 1;
          throw new Error("should not refetch");
        },
      },
    );
    assert.equal(calls, 1);
    assert.deepEqual(again.skipped, ["/packs/maple-point-a101.pdf"]);
  } finally {
    restore();
  }
});

test("a stalled sheet is retried and does not block the other sheet", async () => {
  const fake = createFakeCaches();
  const restore = useCaches(fake);
  try {
    const calls = new Map<string, number>();
    let slowAttemptFinished = false;
    let fastStartedDuringSlowAttempt = false;
    const result = await prefetchOfflinePackPdfs(
      [
        { src: "/packs/maple-point-slow.pdf" },
        { src: "/packs/maple-point-fast.pdf" },
      ],
      {
        attempts: 2,
        concurrency: 2,
        timeoutMs: 40,
        fetchImpl: async (input, init) => {
          const url = String(input);
          const count = (calls.get(url) ?? 0) + 1;
          calls.set(url, count);
          if (url.includes("slow") && count === 1) {
            await new Promise<void>((_resolve, reject) => {
              const signal = init?.signal;
              if (!signal) {
                reject(new Error("missing abort signal"));
                return;
              }
              const fail = () => {
                const error = new Error("timed out");
                error.name = "AbortError";
                reject(error);
              };
              if (signal.aborted) fail();
              else signal.addEventListener("abort", fail, { once: true });
            });
            slowAttemptFinished = true;
          }
          if (url.includes("fast") && !slowAttemptFinished) {
            fastStartedDuringSlowAttempt = true;
          }
          if (url.includes("missing")) {
            return new Response("missing", { status: 404 });
          }
          const bytes = pdfBytes(url);
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Length": String(bytes.byteLength),
            },
          });
        },
      },
    );
    assert.equal(calls.get("/packs/maple-point-slow.pdf"), 2);
    assert.equal(calls.get("/packs/maple-point-fast.pdf"), 1);
    assert.equal(fastStartedDuringSlowAttempt, true);
    assert.equal(result.missed.length, 0);
    assert.equal(result.stored.length, 2);
    assert.equal((await matchCachedPdf("/packs/maple-point-fast.pdf"))?.ok, true);
    assert.equal((await matchCachedPdf("/packs/maple-point-slow.pdf"))?.ok, true);
  } finally {
    restore();
  }
});

test("404 is not retried and a sibling sheet still caches", async () => {
  const fake = createFakeCaches();
  const restore = useCaches(fake);
  try {
    const calls = new Map<string, number>();
    const result = await prefetchOfflinePackPdfs(
      [
        { src: "/packs/maple-point-missing.pdf" },
        { src: "/packs/maple-point-fast.pdf" },
      ],
      {
        attempts: 2,
        concurrency: 2,
        timeoutMs: 1000,
        fetchImpl: async (input) => {
          const url = String(input);
          calls.set(url, (calls.get(url) ?? 0) + 1);
          if (url.includes("missing")) return new Response("no", { status: 404 });
          const bytes = pdfBytes("fast");
          return new Response(bytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Length": String(bytes.byteLength),
            },
          });
        },
      },
    );
    assert.equal(calls.get("/packs/maple-point-missing.pdf"), 1);
    assert.deepEqual(result.missed, ["/packs/maple-point-missing.pdf"]);
    assert.deepEqual(result.stored, ["/packs/maple-point-fast.pdf"]);
  } finally {
    restore();
  }
});

test("overlapping prefetch of one sheet downloads once", async () => {
  const fake = createFakeCaches();
  const restore = useCaches(fake);
  try {
    let calls = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      await gate;
      const bytes = pdfBytes("once");
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(bytes.byteLength),
        },
      });
    };
    const src = "/packs/maple-point-a101.pdf";
    const first = prefetchOfflinePackPdfs([{ src }], {
      fetchImpl,
      attempts: 1,
      concurrency: 1,
    });
    const second = prefetchOfflinePackPdfs([{ src }], {
      fetchImpl,
      attempts: 1,
      concurrency: 1,
    });
    release?.();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.equal(a.stored.length + a.skipped.length, 1);
    assert.equal(b.stored.length + b.skipped.length, 1);
    assert.equal((await matchCachedPdf(src))?.ok, true);
  } finally {
    restore();
  }
});

test("non-pdf bytes are not stored", async () => {
  const fake = createFakeCaches();
  const restore = useCaches(fake);
  try {
    await putPdfBytes(
      "/packs/maple-point-a101.pdf",
      new TextEncoder().encode("<html>no</html>"),
    );
    assert.equal(await matchCachedPdf("/packs/maple-point-a101.pdf"), undefined);
    await putPdfBytes("/packs/maple-point-a101.pdf", pdfBytes("floor"));
    await deleteCachedPdf("/packs/maple-point-a101.pdf");
    assert.equal(await matchCachedPdf("/packs/maple-point-a101.pdf"), undefined);
  } finally {
    restore();
  }
});
