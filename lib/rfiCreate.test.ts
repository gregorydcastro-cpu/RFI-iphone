import assert from "node:assert/strict";
import { test } from "node:test";
import {
  rfiCreateAccepted,
  rfiCreateFailure,
  rfiCreateOutcome,
  rfiCreateSuccessCopy,
  RFI_SAVE_FAILED_MESSAGE,
} from "./rfiCreate.ts";

const forbidden = /Brown|Rossi|Danoff|Suffolk|ILSB|EL107/i;

test("configured rfis insert that does not land is a failed send", () => {
  const result = rfiCreateOutcome({ saved: false, writeConfigured: true });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 503);
    assert.equal(result.code, "save_failed");
    assert.equal(result.storage, "unavailable");
    assert.equal(result.error, RFI_SAVE_FAILED_MESSAGE);
    assert.doesNotMatch(result.error, forbidden);
  }
});

test("a saved row is with the crew and demo mode stays on the phone", () => {
  const saved = rfiCreateOutcome({ saved: true, writeConfigured: true });
  assert.deepEqual(saved, {
    ok: true,
    persisted: true,
    storage: "supabase",
    where: "crew",
  });
  const demo = rfiCreateOutcome({ saved: false, writeConfigured: false });
  assert.deepEqual(demo, {
    ok: true,
    persisted: false,
    storage: "unconfigured",
    where: "phone",
  });
});

test("rfiCreateAccepted rejects unavailable storage", () => {
  assert.equal(rfiCreateAccepted({ ok: true, storage: "supabase" }), true);
  assert.equal(rfiCreateAccepted({ ok: true, storage: "unconfigured" }), true);
  assert.equal(rfiCreateAccepted({ ok: true, storage: "unavailable" }), false);
  assert.equal(rfiCreateAccepted({ ok: false, storage: "supabase" }), false);
});

test("phone failure copy offers retry except view-only and empty fields", () => {
  assert.deepEqual(rfiCreateFailure({ status: 503 }), {
    title: "Draft did not send",
    message: "It is not with the crew. Tap Retry.",
    retry: true,
  });
  assert.deepEqual(rfiCreateFailure({ status: 0 }), {
    title: "Draft did not send",
    message: "No connection. Tap Retry.",
    retry: true,
  });
  assert.equal(rfiCreateFailure({ status: 403 }).retry, false);
  assert.match(rfiCreateFailure({ status: 403 }).message, /view-only/i);
  assert.equal(rfiCreateFailure({ status: 400 }).retry, false);
  const generic = rfiCreateFailure({ status: 503, error: RFI_SAVE_FAILED_MESSAGE });
  assert.equal(generic.message, "It is not with the crew. Tap Retry.");
  const custom = rfiCreateFailure({ status: 500, error: "Server busy. Tap Retry." });
  assert.equal(custom.message, "Server busy. Tap Retry.");
  assert.equal(custom.retry, true);
});

test("success copy splits sent from saved-on-this-phone", () => {
  const sent = rfiCreateSuccessCopy("crew");
  assert.equal(sent.heading, "Draft sent");
  assert.match(sent.summary, /Pat Nguyen has this draft/);
  assert.match(sent.summary, /Not a Procore submit/);
  assert.equal(sent.tone, "sent");

  const phone = rfiCreateSuccessCopy("phone");
  assert.equal(phone.heading, "Saved on this phone");
  assert.match(phone.summary, /does not have it yet/);
  assert.equal(phone.tone, "phone");

  const signedOut = rfiCreateSuccessCopy("signed_out");
  assert.match(signedOut.summary, /signed out/i);
  assert.equal(signedOut.tone, "phone");
  assert.doesNotMatch(JSON.stringify({ sent, phone, signedOut }), forbidden);
});
