import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { RFI_INBOX_LOADING, rfiInboxCrewStatus, rfiInboxShowsLoading, rfiInboxView } from "./rfiInbox.ts";
import {
  PACK_LIVE_LOADING,
  PACK_VIEW_ONLY_LINE,
  classifyPackHttp,
  packLiveFallbackLine,
  packLiveOpeningLine,
  packLiveStatusLine,
  packPayloadState,
} from "./packLoadField.ts";
import { SHEET_LOADING, sheetPdfBanner, sheetPdfSurface, type SheetPdfSurface } from "./sheetPdfErrors.ts";
import type { RfiInboxView } from "./rfiInbox.ts";
import type { RoomPack } from "./pack.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

const maplePack = {
  project: { id: "maple", name: "Maple Point Medical Office", slug: "maple-point" },
  room: { id: "101", name: "Electrical Closet 101", number: "101" },
  sheets: [
    { id: "E-101", rev: "A", pdf: "/packs/maple-point-e101.pdf" },
    { id: "E-102", rev: "A", pdf: "/packs/maple-point-e102.pdf" },
  ],
  rfis: [
    {
      id: "r1",
      number: "RFI-001",
      title: "Panel feed clarification for PP-101",
      status: "open",
    },
    {
      id: "r2",
      number: "RFI-004",
      title: "Spare breaker count for future IT rack",
      status: "answered",
    },
    {
      id: "r3",
      number: "RFI-009",
      title: "Emergency lighting transfer in Closet 101",
      status: "closed",
    },
  ],
  pulled_at: "2026-09-18T00:15:17.277541+00:00",
  revision_stamp: { drawing: "E-101", rev: "A" },
} as RoomPack;

function loadingLines(input: {
  packLine: string;
  sheets: SheetPdfSurface[];
  inbox: RfiInboxView;
}): string[] {
  const lines: string[] = [];
  if (input.packLine === PACK_LIVE_LOADING) lines.push(PACK_LIVE_LOADING);
  if (input.sheets.some((sheet) => sheet.kind === "loading")) lines.push(SHEET_LOADING);
  if (rfiInboxShowsLoading(input.inbox)) lines.push(RFI_INBOX_LOADING);
  return lines;
}

test("signed-out Maple Point pack shows none of the three loading lines after settle", () => {
  const opening = packLiveOpeningLine({
    supabaseConfigured: true,
    demoFallback: false,
    source: "supabase",
    pull: "none",
    pack: maplePack,
  });
  const live = classifyPackHttp({
    httpStatus: 200,
    ok: true,
    body: {
      ok: true,
      source: "supabase",
      pull: "none",
      demoFallback: false,
      pack: maplePack,
    },
  });
  const refreshed = packLiveStatusLine(
    { source: live.source, pull: live.pull, pack: live.pack },
  );
  assert.equal(packPayloadState(live.pack), "ready");
  assert.equal(opening, "Cached pack · E-101 Rev A · pulled 2026-09-18 00:15:17Z.");
  assert.equal(refreshed, opening);

  const sheets = maplePack.sheets.map(() =>
    sheetPdfSurface({ hasPdfUrl: true, ready: true, error: null }),
  );
  const inbox = rfiInboxView({
    crew: rfiInboxCrewStatus({ httpStatus: 401, ok: false }),
    itemCount: maplePack.rfis.length,
    draftCount: 0,
  });
  assert.deepEqual(loadingLines({ packLine: refreshed, sheets, inbox }), []);
  assert.equal(inbox.kind, "list");
  if (inbox.kind === "list") {
    assert.equal(inbox.pending, false);
    assert.equal(inbox.draftsEmpty, false);
    assert.equal(inbox.retry, false);
  }
  assert.equal(forbidden.test([opening, refreshed].join(" ")), false);
});

test("signed-out skips, 403, timeout, empty, and a failed sheet all leave loading", () => {
  const skipped = rfiInboxView({
    crew: "skipped",
    itemCount: 0,
    draftCount: 0,
  });
  assert.equal(skipped.kind, "idle");
  assert.equal(rfiInboxShowsLoading(skipped), false);

  const forbiddenDrafts = rfiInboxView({
    crew: rfiInboxCrewStatus({ httpStatus: 403, ok: false }),
    itemCount: maplePack.rfis.length,
    draftCount: 0,
  });
  assert.equal(rfiInboxShowsLoading(forbiddenDrafts), false);

  const timedDrafts = rfiInboxView({
    crew: rfiInboxCrewStatus({ timedOut: true, thrown: true }),
    itemCount: maplePack.rfis.length,
    draftCount: 0,
  });
  assert.equal(rfiInboxShowsLoading(timedDrafts), false);
  assert.equal(timedDrafts.kind, "list");
  if (timedDrafts.kind === "list") assert.equal(timedDrafts.retry, true);

  const hungPack = classifyPackHttp({
    httpStatus: 0,
    ok: false,
    body: null,
    timedOut: true,
  });
  assert.notEqual(hungPack.notice?.strip, PACK_LIVE_LOADING);
  assert.equal(packLiveFallbackLine(true) === PACK_LIVE_LOADING, false);
  assert.equal(PACK_VIEW_ONLY_LINE === PACK_LIVE_LOADING, false);

  const unauthorized = classifyPackHttp({
    httpStatus: 403,
    ok: false,
    body: { ok: false },
  });
  assert.equal(unauthorized.viewOnly, true);
  assert.equal(unauthorized.notice, null);

  const signedOutPack = classifyPackHttp({
    httpStatus: 401,
    ok: false,
    body: { ok: false },
  });
  assert.notEqual(signedOutPack.notice?.strip, PACK_LIVE_LOADING);

  const emptySheet = sheetPdfSurface({ hasPdfUrl: false, ready: false, error: null });
  const failedSheet = sheetPdfSurface({
    hasPdfUrl: true,
    ready: false,
    error: sheetPdfBanner({ code: "timeout" }),
  });
  const missingSheet = sheetPdfSurface({
    hasPdfUrl: true,
    ready: false,
    error: sheetPdfBanner({ code: "pdf_missing" }),
  });
  assert.equal(emptySheet.kind, "empty");
  assert.equal(failedSheet.kind, "error");
  assert.equal(missingSheet.kind, "empty");
  assert.deepEqual(
    loadingLines({
      packLine: PACK_VIEW_ONLY_LINE,
      sheets: [emptySheet, failedSheet, missingSheet],
      inbox: skipped,
    }),
    [],
  );
});

test("signed-in Maple Point happy path still settles without a loading line", () => {
  const line = packLiveStatusLine(
    {
      source: "procore",
      pull: "procore",
      pack: maplePack,
    },
  );
  assert.match(line, /^Live \(Procore REST\)/);
  assert.equal(line.includes(PACK_LIVE_LOADING), false);

  const sheets = maplePack.sheets.map(() =>
    sheetPdfSurface({ hasPdfUrl: true, ready: true, error: null }),
  );
  const inbox = rfiInboxView({
    crew: rfiInboxCrewStatus({ httpStatus: 200, ok: true }),
    itemCount: maplePack.rfis.length + 1,
    draftCount: 1,
  });
  assert.equal(inbox.kind, "list");
  if (inbox.kind === "list") {
    assert.equal(inbox.pending, false);
    assert.equal(inbox.retry, false);
    assert.equal(inbox.draftsEmpty, false);
  }
  assert.deepEqual(loadingLines({ packLine: line, sheets, inbox }), []);

  const noDrafts = rfiInboxView({
    crew: rfiInboxCrewStatus({ httpStatus: 200, ok: true }),
    itemCount: maplePack.rfis.length,
    draftCount: 0,
  });
  assert.equal(noDrafts.kind, "list");
  if (noDrafts.kind === "list") assert.equal(noDrafts.draftsEmpty, true);
  assert.equal(rfiInboxShowsLoading(noDrafts), false);
});

test("viewers do not wait on a missing canvas, a hung draft read, or offline storage", () => {
  const live = readFileSync(
    new URL("../components/PackLiveReload.tsx", import.meta.url),
    "utf8",
  );
  const sheet = readFileSync(
    new URL("../components/SheetViewer.tsx", import.meta.url),
    "utf8",
  );
  const inbox = readFileSync(new URL("../components/RfiList.tsx", import.meta.url), "utf8");
  assert.match(live, /packLiveOpeningLine/);
  assert.match(live, /PACK_LIVE_LOADING/);
  assert.doesNotMatch(live, /await offline\.remember/);
  assert.match(live, /lineRef\.current === PACK_LIVE_LOADING/);
  assert.match(sheet, /requestAnimationFrame/);
  assert.match(sheet, /SHEET_LOADING/);
  assert.doesNotMatch(sheet, /if \(!pdfUrl \|\| !canvas\) return/);
  assert.match(inbox, /signedIn \? "loading" : "skipped"/);
  assert.match(inbox, /RFI_INBOX_CLIENT_TIMEOUT_MS/);
  assert.doesNotMatch(inbox, /AbortError/);
  assert.equal(forbidden.test([live, sheet, inbox].join("\n")), false);
});
