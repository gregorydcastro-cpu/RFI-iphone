import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canRetrySameAudio,
  parseVoiceErrorBody,
  parseVoiceStatusPayload,
  voiceErrorMessage,
} from "./voiceErrors.ts";

test("parseVoiceErrorBody prefers API code over HTTP status", () => {
  const parsed = parseVoiceErrorBody(
    { ok: false, code: "busy", error: "Voice is busy. Tap retry in a moment." },
    429,
  );
  assert.equal(parsed.code, "busy");
  assert.equal(parsed.message, voiceErrorMessage("busy"));
  assert.equal(canRetrySameAudio(parsed.code), true);
});

test("parseVoiceErrorBody treats configured:false / 503 as unconfigured", () => {
  const fromFlag = parseVoiceErrorBody({ ok: false, configured: false }, 502);
  assert.equal(fromFlag.code, "unconfigured");
  assert.equal(canRetrySameAudio(fromFlag.code), false);

  const fromStatus = parseVoiceErrorBody({}, 503);
  assert.equal(fromStatus.code, "unconfigured");
});

test("parseVoiceStatusPayload never invents configured=true", () => {
  assert.deepEqual(parseVoiceStatusPayload({ ok: true, configured: false, provider: "xai" }), {
    ok: true,
    configured: false,
    provider: "xai",
    code: undefined,
    error: undefined,
  });
  assert.equal(parseVoiceStatusPayload(null).configured, false);
  assert.equal(parseVoiceStatusPayload({ ok: false }).ok, false);
});

test("voice messages stay gloves-readable and leak-free", () => {
  const blob = JSON.stringify({
    unconfigured: voiceErrorMessage("unconfigured"),
    busy: voiceErrorMessage("busy"),
  });
  assert.match(blob, /server voice key/i);
  assert.doesNotMatch(blob, /NEXT_PUBLIC_|sk-|xai-[A-Za-z0-9]{8,}/);
});
