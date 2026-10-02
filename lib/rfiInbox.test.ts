import assert from "node:assert/strict";
import { test } from "node:test";
import {
  RFI_INBOX_DRAFTS_EMPTY,
  RFI_INBOX_EMPTY_TITLE,
  RFI_INBOX_ERROR_NEXT,
  RFI_INBOX_ERROR_TITLE,
  RFI_INBOX_LOADING,
  buildRfiInboxItems,
  parseCrewDraftRows,
  rfiInboxCrewStatus,
  rfiInboxEmptySpeak,
  rfiInboxErrorSpeak,
  rfiInboxView,
} from "./rfiInbox.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107|supabase|api[_ ]?key|PGRST|jwt/i;

test("inbox copy stays short and plain", () => {
  const lines = [
    RFI_INBOX_EMPTY_TITLE,
    RFI_INBOX_DRAFTS_EMPTY,
    RFI_INBOX_ERROR_TITLE,
    RFI_INBOX_ERROR_NEXT,
    RFI_INBOX_LOADING,
    rfiInboxEmptySpeak(),
    rfiInboxErrorSpeak(),
  ];
  for (const line of [RFI_INBOX_EMPTY_TITLE, RFI_INBOX_DRAFTS_EMPTY, RFI_INBOX_ERROR_TITLE, RFI_INBOX_ERROR_NEXT, RFI_INBOX_LOADING]) {
    assert.ok(line.length <= 48, line);
  }
  assert.match(rfiInboxEmptySpeak(), /No RFIs yet/);
  assert.match(rfiInboxEmptySpeak(), /Tap Create RFI/);
  assert.match(rfiInboxErrorSpeak(), /Tap Retry/);
  assert.equal(/failed|error|procore/i.test(rfiInboxEmptySpeak()), false);
  assert.doesNotMatch(lines.join(" "), forbidden);
});

test("a dropped drafts load is not an empty inbox", () => {
  assert.equal(rfiInboxCrewStatus({ thrown: true }), "error");
  assert.equal(rfiInboxCrewStatus({ httpStatus: 503, ok: false }), "error");
  assert.equal(rfiInboxCrewStatus({ httpStatus: 401, ok: false }), "ok");
  assert.equal(rfiInboxCrewStatus({ httpStatus: 200, ok: true }), "ok");

  assert.deepEqual(
    rfiInboxView({ crew: "loading", itemCount: 0, draftCount: 0 }),
    { kind: "loading" },
  );
  assert.deepEqual(
    rfiInboxView({ crew: "error", itemCount: 0, draftCount: 0 }),
    { kind: "error" },
  );
  assert.deepEqual(
    rfiInboxView({ crew: "ok", itemCount: 0, draftCount: 0 }),
    { kind: "empty" },
  );
  assert.deepEqual(
    rfiInboxView({ crew: "error", itemCount: 2, draftCount: 0 }),
    { kind: "list", retry: true, pending: false, draftsEmpty: false },
  );
  assert.deepEqual(
    rfiInboxView({ crew: "ok", itemCount: 1, draftCount: 0 }),
    { kind: "list", retry: false, pending: false, draftsEmpty: true },
  );
  assert.deepEqual(
    rfiInboxView({ crew: "loading", itemCount: 1, draftCount: 0 }),
    { kind: "list", retry: false, pending: true, draftsEmpty: false },
  );
});

test("inbox keeps this room's drafts and linked RFIs, once each", () => {
  const items = buildRfiInboxItems({
    requestId: "maple-point-733",
    sheetIds: ["A-101"],
    localDrafts: [
      {
        id: "local-1",
        subject: "Panel feed",
        status: "draft",
        requestId: "maple-point-733",
        sheetId: "A-101",
      },
      {
        id: "other-job",
        subject: "Skip me",
        status: "draft",
        requestId: "cedar-ridge-200",
      },
    ],
    crewDrafts: [
      {
        id: "local-1",
        subject: "Panel feed",
        status: "draft",
        sheetId: "A-101",
      },
      {
        id: "crew-2",
        subject: "  ",
        status: "ready",
        sheetId: "A-101",
      },
      {
        id: "other-sheet",
        subject: "Other room",
        status: "draft",
        sheetId: "E-900",
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
  });

  assert.deepEqual(
    items.map((item) => item.id),
    ["local-1", "crew-2", "r1"],
  );
  assert.equal(items[0]?.number, "Draft");
  assert.equal(items[1]?.title, "Untitled draft");
  assert.equal(items[2]?.number, "RFI-001");
  assert.doesNotMatch(JSON.stringify(items), forbidden);
});

test("crew payload junk does not become a cryptic row", () => {
  const rows = parseCrewDraftRows([
    { id: "ok", subject: "Lighting", status: "draft", sheet_id: "A-101" },
    { subject: "missing id" },
    null,
    "nope",
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.subject, "Lighting");
  assert.equal(rows[0]?.sheetId, "A-101");
  assert.deepEqual(parseCrewDraftRows({ error: "PGRST301" }), []);
});
