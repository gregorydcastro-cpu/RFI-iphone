import assert from "node:assert/strict";
import { test } from "node:test";
import {
  VOICE_EMPTY_COPY,
  voiceEmptyKindFromMicError,
  voiceEmptyKindFromTranscript,
  voiceEmptyMessage,
} from "./voiceEmpty.ts";

test("voice empty copy stays short and calm", () => {
  const blob = Object.values(VOICE_EMPTY_COPY).join(" ");
  assert.match(blob, /Nothing heard yet/);
  assert.match(blob, /Mic is off/);
  assert.match(blob, /Nothing to read yet/);
  assert.equal(/failed|error|retry|procore|api[_ ]?key/i.test(blob), false);
  assert.equal(voiceEmptyMessage("silent"), VOICE_EMPTY_COPY.silent);
  for (const line of Object.values(VOICE_EMPTY_COPY)) {
    assert.ok(line.length <= 48, line);
  }
});

test("mic denial and a missing mic are empty states, not a voice failure", () => {
  assert.equal(
    voiceEmptyKindFromMicError({ name: "NotAllowedError" }),
    "denied",
  );
  assert.equal(
    voiceEmptyKindFromMicError({ name: "NotFoundError" }),
    "missing",
  );
  assert.equal(voiceEmptyKindFromMicError(new Error("nope")), null);
  assert.equal(voiceEmptyKindFromMicError(null), null);
});

test("empty transcript is silent; a dropped voice call stays an error", () => {
  assert.equal(
    voiceEmptyKindFromTranscript({ httpOk: true, text: "  ", code: "failed" }),
    "silent",
  );
  assert.equal(
    voiceEmptyKindFromTranscript({
      httpOk: false,
      text: "",
      code: "no_speech",
    }),
    "silent",
  );
  assert.equal(
    voiceEmptyKindFromTranscript({
      httpOk: false,
      text: "",
      code: "unreachable",
    }),
    null,
  );
  assert.equal(
    voiceEmptyKindFromTranscript({
      httpOk: true,
      text: "pull room 101",
      code: "failed",
    }),
    null,
  );
});
