import assert from "node:assert/strict";
import { test } from "node:test";
import type { ShareRefreshItem } from "./shareRefresh.ts";
import {
  SHARE_REFRESH_BUSY_LABEL,
  SHARE_REFRESH_PROGRESS_LABEL,
  describeShareRefreshOutcome,
  shareRefreshBlockedMessage,
  shareRefreshFailureMessage,
} from "./shareRefreshStatus.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

function item(
  partial: Pick<ShareRefreshItem, "pin_id" | "sheet_id" | "status"> &
    Partial<ShareRefreshItem>,
): ShareRefreshItem {
  return {
    folder_id: "folder-1",
    project_name: "Maple Point Medical Office",
    previous_rev: "A",
    cached_rev: "A",
    current_rev: partial.status === "missing" ? null : "A",
    ...partial,
  };
}

test("refresh labels stay specific while a check is in flight", () => {
  assert.equal(SHARE_REFRESH_BUSY_LABEL, "Refreshing…");
  assert.equal(SHARE_REFRESH_PROGRESS_LABEL, "Checking pinned sheet revisions…");
  assert.equal(/Working/i.test(SHARE_REFRESH_BUSY_LABEL), false);
});

test("empty refresh tells the crew to pin a Maple Point pack", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 0,
    bumped: 0,
    unchanged: 0,
    missing: 0,
    items: [],
    errors: [],
    notify: { code: "no_bumps" },
  });
  assert.equal(outcome.tone, "empty");
  assert.equal(outcome.headline, "No pinned sheets to check.");
  assert.deepEqual(
    outcome.lines.map((line) => line.text),
    ["Pin a Maple Point pack or discipline, then refresh again."],
  );
  assert.equal(outcome.notifyLine, null);
  assert.equal(forbidden.test(JSON.stringify(outcome)), false);
});

test("unchanged Maple Point pins read as current", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 2,
    bumped: 0,
    unchanged: 2,
    missing: 0,
    items: [
      item({ pin_id: "pin-a", sheet_id: "A-101", status: "unchanged" }),
      item({ pin_id: "pin-e", sheet_id: "E-101", status: "unchanged" }),
    ],
    notify: { code: "no_bumps" },
  });
  assert.equal(outcome.tone, "clear");
  assert.equal(outcome.headline, "All 2 pinned sheets are current.");
  assert.deepEqual(outcome.lines, []);
  assert.equal(outcome.notifyLine, null);
  assert.equal(outcome.marks["pin-a"], "current");
  assert.equal(outcome.marks["pin-e"], "current");
});

test("a single current pin does not use a plural headline", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 1,
    items: [item({ pin_id: "pin-a", sheet_id: "A-101", status: "unchanged" })],
  });
  assert.equal(outcome.headline, "Pinned sheet is current.");
});

test("a bumped pin names the old and new revision", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 2,
    bumped: 1,
    unchanged: 1,
    missing: 0,
    items: [
      item({ pin_id: "pin-a", sheet_id: "A-101", status: "unchanged" }),
      item({
        pin_id: "pin-e",
        sheet_id: "E-101",
        status: "bumped",
        previous_rev: "A",
        current_rev: "B",
      }),
    ],
    notify: { sent: true, code: "sent" },
  });
  assert.equal(outcome.tone, "clear");
  assert.equal(outcome.headline, "Checked 2 pinned sheets. 1 revision updated.");
  assert.deepEqual(outcome.lines, [
    { tone: "update", text: "E-101 moved from Rev A to Rev B." },
  ]);
  assert.equal(outcome.notifyLine, "Revision email sent.");
  assert.equal(outcome.marks["pin-e"], "bumped");
  assert.equal(outcome.marks["pin-a"], "current");
});

test("a missing pin is called out instead of counted as success", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 2,
    bumped: 0,
    unchanged: 1,
    missing: 1,
    items: [
      item({ pin_id: "pin-a", sheet_id: "A-101", status: "unchanged" }),
      item({
        pin_id: "pin-z",
        sheet_id: "Z-999",
        status: "missing",
        current_rev: null,
      }),
    ],
  });
  assert.equal(outcome.tone, "partial");
  assert.equal(outcome.headline, "Checked 2 pinned sheets. 1 could not refresh.");
  assert.equal(
    outcome.lines[0]?.text,
    "Z-999 could not be refreshed. No current revision is on the pack.",
  );
  assert.equal(outcome.marks["pin-z"], "unavailable");
});

test("every pin missing is a failure headline", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 1,
    missing: 1,
    items: [
      item({
        pin_id: "pin-z",
        sheet_id: "Z-999",
        status: "missing",
        current_rev: null,
      }),
    ],
  });
  assert.equal(outcome.headline, "That pinned sheet could not be refreshed.");
  assert.equal(outcome.tone, "partial");
});

test("a save failure does not claim the revision updated", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 1,
    bumped: 1,
    items: [
      item({
        pin_id: "pin-e",
        sheet_id: "E-101",
        status: "bumped",
        previous_rev: "A",
        current_rev: "B",
      }),
    ],
    errors: [
      {
        pin_id: "pin-e",
        sheet_id: "E-101",
        project_name: "Maple Point Medical Office",
        error: "pinned_sheets rev patch failed",
      },
    ],
    notify: { code: "persist_failed" },
  });
  assert.equal(outcome.tone, "partial");
  assert.equal(outcome.headline, "That pinned sheet could not be refreshed.");
  assert.deepEqual(
    outcome.lines.map((line) => line.text),
    ["E-101 could not be saved. It is still on the previous revision."],
  );
  assert.equal(outcome.marks["pin-e"], "unavailable");
  assert.equal(
    outcome.notifyLine,
    "No revision email — the revision update did not save.",
  );
  assert.equal(JSON.stringify(outcome).includes("pinned_sheets"), false);
});

test("a cache write failure stays partial without hiding current sheets", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 1,
    unchanged: 1,
    items: [item({ pin_id: "pin-a", sheet_id: "A-101", status: "unchanged" })],
    errors: [{ error: "sheet_revision_cache upsert failed" }, { error: "sheet_revision_cache upsert failed" }],
  });
  assert.equal(outcome.tone, "partial");
  assert.equal(outcome.headline, "Pinned sheet is current.");
  assert.deepEqual(outcome.lines, [
    {
      tone: "problem",
      text: "Revision notes could not be saved. Try Refresh all again.",
    },
  ]);
  assert.equal(outcome.marks["pin-a"], "current");
});

test("notify skips stay quiet when nothing changed", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 1,
    unchanged: 1,
    items: [item({ pin_id: "pin-a", sheet_id: "A-101", status: "unchanged" })],
    notify: { code: "notify_unconfigured" },
  });
  assert.equal(outcome.notifyLine, null);
});

test("a bump without a notify address says to set it on Account", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 1,
    bumped: 1,
    items: [
      item({
        pin_id: "pin-e",
        sheet_id: "E-102",
        status: "bumped",
        previous_rev: "",
        current_rev: "C",
      }),
    ],
    notify: { code: "notify_email_unset" },
  });
  assert.equal(outcome.lines[0]?.text, "E-102 is now Rev C.");
  assert.equal(
    outcome.notifyLine,
    "No revision email — set the notify address on Account.",
  );
});

test("send failure keeps the refresh and says the email did not send", () => {
  const outcome = describeShareRefreshOutcome({
    scanned: 1,
    bumped: 1,
    items: [
      item({
        pin_id: "pin-e",
        sheet_id: "E-101",
        status: "bumped",
        previous_rev: "A",
        current_rev: "B",
      }),
    ],
    notify: { code: "send_failed" },
  });
  assert.equal(
    outcome.notifyLine,
    "The revision email did not send. The sheet check still saved.",
  );
});

test("viewer and disconnected puller copy is honest", () => {
  assert.equal(
    shareRefreshBlockedMessage({ canRefresh: false, procoreConnected: false }),
    "Refresh all is for pullers. You can still create folders and pin Maple Point packs.",
  );
  assert.equal(
    shareRefreshBlockedMessage({ canRefresh: true, procoreConnected: false }),
    "Procore isn't connected. Refresh all checks known pack revisions only. Connect Procore on Account before a live pack pull.",
  );
  assert.equal(
    shareRefreshBlockedMessage({ canRefresh: true, procoreConnected: true }),
    null,
  );
  assert.equal(
    shareRefreshBlockedMessage({
      canRefresh: true,
      procoreConnected: false,
      reconnectNeeded: true,
    }),
    "Procore needs a reconnect. Refresh all still checks saved revisions. Reconnect before a live pack pull.",
  );
  assert.equal(forbidden.test(PROCORE_AND_VIEWER), false);
});

const PROCORE_AND_VIEWER = [
  shareRefreshBlockedMessage({ canRefresh: false, procoreConnected: false }),
  shareRefreshBlockedMessage({ canRefresh: true, procoreConnected: false }),
].join(" ");

test("failed refresh hides cookie and table jargon", () => {
  assert.equal(
    shareRefreshFailureMessage({ status: 401, error: "Sign in first." }),
    "Sign in to refresh pinned sheets.",
  );
  assert.equal(
    shareRefreshFailureMessage({
      status: 403,
      error:
        "Puller role required. Sign in as a puller, or Connect Procore (procoreLinked cookie after OAuth, or x-procore-linked header).",
    }),
    "Refresh all is for pullers. You can still create folders and pin Maple Point packs.",
  );
  assert.equal(
    shareRefreshFailureMessage({
      status: 500,
      error: "sheet_revision_cache upsert failed",
    }),
    "Refresh all did not finish. Try again.",
  );
  assert.equal(
    shareRefreshFailureMessage({ status: 500, error: "Could not load folders" }),
    "Could not load folders",
  );
  assert.equal(shareRefreshFailureMessage({ status: 500 }), "Refresh all did not finish. Try again.");
  assert.equal(
    shareRefreshFailureMessage({ status: 0 }),
    "Refresh all didn't finish. Saved pins stay put. Retry.",
  );
});
