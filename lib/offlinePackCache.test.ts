import assert from "node:assert/strict";
import { test } from "node:test";
import type { RoomPack } from "./pack.ts";
import {
  blobRefsForPack,
  buildOfflinePackSnapshot,
  isOfflineFetchFailure,
  isOfflineSnapshotExpired,
  lookupFromPack,
  offlineBannerText,
  offlinePackCacheKey,
  offlinePackLatestKey,
  OFFLINE_PACK_TZ,
  packCalendarDayKey,
  pickValidOfflineSnapshot,
  shouldUseOfflineFallback,
  shouldWriteOfflineSnapshot,
} from "./offlinePackCache.ts";

const forbidden = /Brown|Rossi/i;

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
  rfis: [
    {
      id: "r1",
      number: "RFI-001",
      title: "Panel feed clarification",
      status: "open",
    },
  ],
  layout: { sheet: "A-101" },
  actions: [],
};

test("cache key is project + pack/room + drawing rev stamp", () => {
  const lookup = lookupFromPack(maplePack);
  assert.equal(lookup.projectId, "maple-point");
  assert.equal(lookup.requestId, "maple-point-733");
  assert.equal(lookup.roomId, "room-733");
  assert.deepEqual(lookup.revisionStamp, { drawing: "A-101", rev: "A" });
  assert.equal(
    offlinePackCacheKey(lookup),
    "gcfieldlog.offline-pack.v1:maple-point:maple-point-733:room-733:A-101:A",
  );
  assert.equal(
    offlinePackLatestKey(lookup),
    "gcfieldlog.offline-pack.latest.v1:maple-point:maple-point-733:room-733",
  );
});

test("revision letter change is a different cache key", () => {
  const revA = offlinePackCacheKey({
    projectId: "maple-point",
    requestId: "maple-point-733",
    roomId: "733",
    revisionStamp: { drawing: "A-101", rev: "A" },
  });
  const revB = offlinePackCacheKey({
    projectId: "maple-point",
    requestId: "maple-point-733",
    roomId: "733",
    revisionStamp: { drawing: "A-101", rev: "B" },
  });
  assert.notEqual(revA, revB);
  assert.match(revB, /A-101:B$/);
  assert.equal(
    offlinePackLatestKey({
      projectId: "maple-point",
      requestId: "maple-point-733",
      roomId: "733",
      revisionStamp: { drawing: "A-101", rev: "A" },
    }),
    offlinePackLatestKey({
      projectId: "maple-point",
      requestId: "maple-point-733",
      roomId: "733",
      revisionStamp: { drawing: "A-101", rev: "B" },
    }),
  );
});

test("calendar day key uses America/New_York not UTC", () => {
  assert.equal(OFFLINE_PACK_TZ, "America/New_York");
  // 2026-09-21 03:59:59Z is still 2026-09-20 23:59 EDT (UTC-4).
  assert.equal(
    packCalendarDayKey("2026-09-21T03:59:59.000Z"),
    "2026-09-20",
  );
  assert.equal(
    packCalendarDayKey("2026-09-21T04:00:00.000Z"),
    "2026-09-21",
  );
  // Winter EST (UTC-5): 04:59Z is still the previous calendar day.
  assert.equal(
    packCalendarDayKey("2026-12-15T04:59:59.000Z"),
    "2026-12-14",
  );
  assert.equal(
    packCalendarDayKey("2026-12-15T05:00:00.000Z"),
    "2026-12-15",
  );
});

test("day's packs expire at the next America/New_York midnight", () => {
  const morning = buildOfflinePackSnapshot({
    pack: maplePack,
    cachedAt: "2026-09-21T12:00:00.000Z",
  });
  assert.equal(morning.dayKey, "2026-09-21");
  assert.equal(
    isOfflineSnapshotExpired(morning, "2026-09-21T20:00:00.000Z"),
    false,
  );
  assert.equal(
    isOfflineSnapshotExpired(morning, "2026-09-22T04:00:00.000Z"),
    true,
  );

  const lateEdt = buildOfflinePackSnapshot({
    pack: maplePack,
    cachedAt: "2026-09-21T03:30:00.000Z",
  });
  assert.equal(lateEdt.dayKey, "2026-09-20");
  assert.equal(
    isOfflineSnapshotExpired(lateEdt, "2026-09-21T03:59:00.000Z"),
    false,
  );
  assert.equal(
    isOfflineSnapshotExpired(lateEdt, "2026-09-21T04:00:00.000Z"),
    true,
  );
});

test("expired yesterday snapshot is not picked even if request id matches", () => {
  const stale = buildOfflinePackSnapshot({
    pack: maplePack,
    cachedAt: "2026-09-20T15:00:00.000Z",
  });
  const fresh = buildOfflinePackSnapshot({
    pack: maplePack,
    cachedAt: "2026-09-21T15:00:00.000Z",
  });
  const picked = pickValidOfflineSnapshot(
    [stale, fresh],
    { requestId: "maple-point-733", projectId: "maple-point" },
    "2026-09-21T18:00:00.000Z",
  );
  assert.equal(picked?.cachedAt, fresh.cachedAt);
  const none = pickValidOfflineSnapshot(
    [stale],
    { requestId: "maple-point-733" },
    "2026-09-21T18:00:00.000Z",
  );
  assert.equal(none, null);
});

test("blob refs use existing viewer proxy / same-origin pack paths", () => {
  const refs = blobRefsForPack(maplePack);
  assert.deepEqual(
    refs.map((ref) => ref.src),
    ["/packs/maple-point-a101.pdf", "/packs/maple-point-e101.pdf"],
  );
  const liveLike: RoomPack = {
    ...maplePack,
    request_id: "maple-point-live",
    sheets: [
      {
        id: "A-101",
        rev: "A",
        pdf: "",
        preview: "https://drive.google.com/file/d/mapleDemoFileId0001/view",
      },
    ],
  };
  const proxied = blobRefsForPack(liveLike);
  assert.equal(
    proxied[0]?.src,
    "/api/sheet-pdf?requestId=maple-point-live&sheetId=A-101",
  );
});

test("write on live success; fallback only after a live miss", () => {
  assert.equal(
    shouldWriteOfflineSnapshot({ pack: maplePack, gotLivePack: true }),
    true,
  );
  assert.equal(
    shouldWriteOfflineSnapshot({ pack: maplePack, gotLivePack: false }),
    false,
  );
  assert.equal(
    shouldWriteOfflineSnapshot({
      pack: { ...maplePack, sheets: [] },
      gotLivePack: true,
    }),
    false,
  );
  assert.equal(shouldUseOfflineFallback({ gotLivePack: true }), false);
  assert.equal(shouldUseOfflineFallback({ gotLivePack: false }), true);
});

test("view-only 403 is not treated as an offline miss", () => {
  assert.equal(isOfflineFetchFailure({ threw: true }), true);
  assert.equal(isOfflineFetchFailure({ ok: false, status: 500 }), true);
  assert.equal(isOfflineFetchFailure({ ok: false, status: 403 }), false);
  assert.equal(isOfflineFetchFailure({ ok: true, status: 200 }), false);
});

test("banner names the cached stamp and does not use real client names", () => {
  const snapshot = buildOfflinePackSnapshot({
    pack: maplePack,
    cachedAt: "2026-09-21T14:00:00.000Z",
  });
  const line = offlineBannerText(snapshot);
  assert.match(line, /^Offline — showing cached pack from /);
  assert.match(line, /A-101 Rev A/);
  assert.equal(forbidden.test(line), false);
  assert.equal(forbidden.test(JSON.stringify(snapshot)), false);
});
