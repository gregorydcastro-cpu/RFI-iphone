import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  PHOTO_ATTACH_MAX_BYTES,
  PHOTO_EMPTY_MESSAGE,
  PHOTO_EMPTY_TITLE,
  PHOTO_READ_MESSAGE,
  PHOTO_TOO_LARGE_MESSAGE,
  photoAttachBanner,
  photoAttachBatchOutcome,
  photoAttachFromFile,
  photoAttachSurface,
} from "./photoAttachField.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("a photo over 3.5 MB is pick-again, and a stopped read is Retry", () => {
  assert.equal(photoAttachFromFile({ size: 0 }), "empty");
  assert.equal(photoAttachFromFile({ size: Number.NaN }), "empty");
  assert.equal(photoAttachFromFile({ size: 1 }), "readable");
  assert.equal(photoAttachFromFile({ size: PHOTO_ATTACH_MAX_BYTES }), "readable");
  assert.equal(
    photoAttachFromFile({ size: PHOTO_ATTACH_MAX_BYTES + 1 }),
    "too_large",
  );

  const tooLarge = photoAttachBanner("too_large");
  const unread = photoAttachBanner("unreadable");
  assert.equal(tooLarge.title, "Photo is too large");
  assert.equal(tooLarge.message, PHOTO_TOO_LARGE_MESSAGE);
  assert.equal(tooLarge.action, "pick");
  assert.match(tooLarge.message, /Pick again/);
  assert.equal(tooLarge.speak, `${tooLarge.title}. ${tooLarge.message}`);
  assert.equal(unread.title, "Photo did not attach");
  assert.equal(unread.message, PHOTO_READ_MESSAGE);
  assert.equal(unread.action, "retry");
  assert.match(unread.message, /Tap Retry/);
  assert.notEqual(tooLarge.action, unread.action);
});

test("nothing to attach is a status, and a failed read is an alert", () => {
  const none = photoAttachSurface({ notice: "empty" });
  const idle = photoAttachSurface({ notice: null });
  const reading = photoAttachSurface({ pending: true, notice: "unreadable" });
  const tooLarge = photoAttachSurface({ notice: "too_large" });
  const unread = photoAttachSurface({ notice: "unreadable" });
  assert.equal(none.kind, "empty");
  assert.equal(idle.kind, "idle");
  assert.equal(reading.kind, "reading");
  assert.equal(tooLarge.kind, "error");
  assert.equal(unread.kind, "error");
  if (none.kind === "empty" && tooLarge.kind === "error" && unread.kind === "error") {
    assert.equal(none.title, PHOTO_EMPTY_TITLE);
    assert.equal(none.message, PHOTO_EMPTY_MESSAGE);
    assert.equal(/retry|failed|error/i.test(none.message), false);
    assert.equal(/retry|failed|error/i.test(none.speak), false);
    assert.equal(tooLarge.action, "pick");
    assert.equal(unread.action, "retry");
    assert.notEqual(none.title, unread.title);
  }

  assert.equal(
    photoAttachBatchOutcome({
      fileCount: 0,
      emptyCount: 0,
      tooLargeCount: 0,
      readFailCount: 0,
      attachedCount: 0,
    }),
    "empty",
  );
  assert.equal(
    photoAttachBatchOutcome({
      fileCount: 1,
      emptyCount: 1,
      tooLargeCount: 0,
      readFailCount: 0,
      attachedCount: 0,
    }),
    "empty",
  );
  assert.equal(
    photoAttachBatchOutcome({
      fileCount: 1,
      emptyCount: 0,
      tooLargeCount: 1,
      readFailCount: 0,
      attachedCount: 0,
    }),
    "too_large",
  );
  assert.equal(
    photoAttachBatchOutcome({
      fileCount: 2,
      emptyCount: 0,
      tooLargeCount: 1,
      readFailCount: 0,
      attachedCount: 1,
    }),
    "too_large",
  );
  assert.equal(
    photoAttachBatchOutcome({
      fileCount: 2,
      emptyCount: 0,
      tooLargeCount: 1,
      readFailCount: 1,
      attachedCount: 0,
    }),
    "unreadable",
  );
  assert.equal(
    photoAttachBatchOutcome({
      fileCount: 1,
      emptyCount: 0,
      tooLargeCount: 0,
      readFailCount: 0,
      attachedCount: 1,
    }),
    "idle",
  );
});

test("RFI photo and submit cards keep Retry and Hear this, and empty stays a status", () => {
  const banner = readFileSync(
    new URL("../components/RfiFieldBanner.tsx", import.meta.url),
    "utf8",
  );
  const form = readFileSync(
    new URL("../components/GenerateRfiForm.tsx", import.meta.url),
    "utf8",
  );
  const sheet = readFileSync(
    new URL("../components/SheetPdfErrorBanner.tsx", import.meta.url),
    "utf8",
  );
  const errorCard = banner.slice(0, banner.indexOf("type EmptyProps"));
  const emptyCard = banner.slice(banner.indexOf("type EmptyProps"));
  assert.match(errorCard, /role="alert"/);
  assert.match(errorCard, /min-h-12 w-full/);
  assert.match(errorCard, /Hear this/);
  assert.match(errorCard, /Retry/);
  assert.match(sheet, /min-h-12 w-full/);
  assert.match(emptyCard, /role="status"/);
  assert.match(emptyCard, /Hear this/);
  assert.doesNotMatch(emptyCard, /Retry/);
  assert.doesNotMatch(emptyCard, /role="alert"/);

  assert.match(form, /RfiFieldBanner/);
  assert.match(form, /RfiFieldEmptyState/);
  assert.match(form, /rfiCreateSpeak\(createFailure\)/);
  assert.match(form, /speakId="rfi-submit-error"/);
  assert.match(form, /speakId="rfi-photo-error"/);
  assert.match(form, /speakId="rfi-photo-empty"/);
  assert.match(form, /Pick again/);
  assert.match(form, /createFailure\.retry/);
  assert.match(form, /photoAttachFromFile/);
  assert.match(form, /readFailCount/);
  assert.doesNotMatch(form, /Photo is too large for this draft/);
  assert.equal(form.includes("SUPABASE_SERVICE_ROLE"), false);
  assert.equal(forbidden.test([banner, form].join("\n")), false);
});
