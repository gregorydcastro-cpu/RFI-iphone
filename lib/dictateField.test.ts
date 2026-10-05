import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  bindDictateDrop,
  DICTATE_ATTEMPTS,
  DICTATE_BACKOFF_MS,
  DICTATE_DEVICE_MESSAGE,
  DICTATE_NETWORK_MESSAGE,
  DICTATE_PERMISSION_MESSAGE,
  dictateDropBanner,
  dictateDropFromName,
  dictateDropFromStop,
  dictateDropFromTrackEnd,
  dictateEmptyCard,
  dictateFieldSurface,
  dictateNetworkFromVoice,
  dictateVoiceBanner,
  shouldAutoRetryDictate,
  type DictateDrop,
  type DictatePermission,
  type DictateRecorder,
  type DictateTrack,
} from "./dictateField.ts";

const SECRET_MARKERS = [
  "BEGIN PRIVATE",
  "SUPABASE_SERVICE_ROLE",
  "XAI_API_KEY",
  "sk-",
  "ya29.",
];

type Listener = () => void;
type ErrorListener = (event: { error?: unknown }) => void;

function track(): DictateTrack & { emit(): void; size(): number } {
  const listeners = new Set<Listener>();
  return {
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    emit() {
      for (const listener of listeners) listener();
    },
    size: () => listeners.size,
  };
}

function recorder(): DictateRecorder & {
  emit(error?: unknown): void;
  size(): number;
} {
  const listeners = new Set<ErrorListener>();
  return {
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    emit(error?: unknown) {
      for (const listener of listeners) listener({ error });
    },
    size: () => listeners.size,
  };
}

function permission(initial: string): DictatePermission & {
  state: string;
  emit(): void;
  size(): number;
} {
  const listeners = new Set<Listener>();
  return {
    state: initial,
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    emit() {
      for (const listener of listeners) listener();
    },
    size: () => listeners.size,
  };
}

test("mic permission, a gone mic, and a network drop use distinct Retry lines", () => {
  const permissionDrop = dictateDropBanner("permission");
  const device = dictateDropBanner("device");
  const network = dictateDropBanner("network");
  assert.equal(permissionDrop.title, "Mic permission dropped");
  assert.equal(permissionDrop.message, DICTATE_PERMISSION_MESSAGE);
  assert.equal(device.title, "Mic dropped");
  assert.equal(device.message, DICTATE_DEVICE_MESSAGE);
  assert.equal(network.title, "Dictation did not finish");
  assert.equal(network.message, DICTATE_NETWORK_MESSAGE);
  assert.match(network.message, /Shaky signal/);
  assert.match(network.message, /Tap Retry/);
  assert.match(permissionDrop.speak, /Tap Retry/);
  assert.match(device.speak, /Tap Retry/);
  assert.equal(permissionDrop.retrySameAudio, false);
  assert.equal(device.retrySameAudio, false);
  assert.equal(network.retrySameAudio, true);
  assert.notEqual(permissionDrop.title, device.title);
  assert.notEqual(device.message, network.message);
  for (const banner of [permissionDrop, device, network]) {
    for (const marker of SECRET_MARKERS) {
      assert.equal(banner.speak.includes(marker), false);
    }
  }
});

test("empty clip and a denied mic before the take are status, not a drop", () => {
  const silent = dictateFieldSurface({ emptyKind: "silent" });
  const denied = dictateFieldSurface({ emptyKind: "denied" });
  const missing = dictateFieldSurface({ emptyKind: "missing" });
  const idle = dictateFieldSurface({ emptyKind: "idle" });
  const network = dictateFieldSurface({ drop: "network", emptyKind: "silent" });
  assert.equal(silent.kind, "empty");
  assert.equal(denied.kind, "empty");
  assert.equal(missing.kind, "empty");
  assert.equal(idle.kind, "ready");
  assert.equal(network.kind, "error");
  assert.equal(dictateEmptyCard("idle"), null);
  assert.equal(dictateEmptyCard("unread"), null);
  if (silent.kind === "empty" && denied.kind === "empty" && network.kind === "error") {
    assert.equal(silent.title, "Nothing heard");
    assert.equal(/retry|failed|error/i.test(silent.message), false);
    assert.equal(/retry|failed|error/i.test(silent.speak), false);
    assert.equal(/retry|failed|error/i.test(denied.message), false);
    assert.match(denied.speak, /Mic is off/);
    assert.match(network.message, /Tap Retry/);
    assert.notEqual(silent.title, network.title);
    assert.notEqual(denied.title, dictateDropBanner("permission").title);
  }
  assert.equal(dictateFieldSurface({ errorCode: "no_speech" }).kind, "empty");
  assert.equal(dictateFieldSurface({ heard: "pull room 101" }).kind, "heard");
  assert.equal(dictateFieldSurface({ recording: true, drop: "device" }).kind, "listening");
  assert.equal(dictateFieldSurface({ pending: true, drop: "network" }).kind, "saving");
});

test("voice route failures keep a banner, and a dead connection is the shaky-signal card", () => {
  assert.equal(dictateNetworkFromVoice({ thrown: true }), true);
  assert.equal(dictateNetworkFromVoice({ offline: true }), true);
  assert.equal(dictateNetworkFromVoice({ code: "unreachable", httpStatus: 502 }), true);
  assert.equal(dictateNetworkFromVoice({ code: "timeout", httpStatus: 504 }), true);
  assert.equal(dictateNetworkFromVoice({ code: "busy", httpStatus: 429 }), false);
  assert.equal(dictateNetworkFromVoice({ code: "unconfigured", httpStatus: 503 }), false);
  assert.equal(dictateNetworkFromVoice({ code: "no_speech", httpStatus: 422 }), false);
  const shaky = dictateVoiceBanner("unreachable");
  assert.equal(shaky.message, DICTATE_NETWORK_MESSAGE);
  assert.equal(shaky.retrySameAudio, true);
  const busy = dictateVoiceBanner("busy");
  assert.match(busy.message, /Tap retry/);
  assert.equal(busy.retrySameAudio, true);
  const off = dictateVoiceBanner("unconfigured");
  assert.match(off.title, /Voice is off/);
  assert.equal(off.retrySameAudio, false);
  assert.equal(off.speak.includes("XAI_API_KEY"), false);
});

test("a fast network drop retries once; a dead mic does not", () => {
  assert.equal(DICTATE_ATTEMPTS, 2);
  assert.equal(DICTATE_BACKOFF_MS, 400);
  assert.equal(shouldAutoRetryDictate({ attempt: 0, network: true }), true);
  assert.equal(shouldAutoRetryDictate({ attempt: 1, network: true }), false);
  assert.equal(shouldAutoRetryDictate({ attempt: 0, drop: "network" }), true);
  assert.equal(shouldAutoRetryDictate({ attempt: 0, drop: "permission" }), false);
  assert.equal(shouldAutoRetryDictate({ attempt: 0, drop: "device" }), false);
  assert.equal(shouldAutoRetryDictate({ attempt: 0, network: false }), false);
});

test("track end and recorder errors name permission, device, or network", () => {
  assert.equal(dictateDropFromName("NotAllowedError"), "permission");
  assert.equal(dictateDropFromName("SecurityError"), "permission");
  assert.equal(dictateDropFromName("NotFoundError"), "device");
  assert.equal(dictateDropFromName("NotReadableError"), "device");
  assert.equal(dictateDropFromName("NetworkError"), "network");
  assert.equal(dictateDropFromName("Error"), null);
  assert.equal(dictateDropFromTrackEnd("denied"), "permission");
  assert.equal(dictateDropFromTrackEnd("granted"), "device");
  assert.equal(dictateDropFromTrackEnd(null), "device");

  assert.equal(
    dictateDropFromStop({
      userStop: true,
      already: null,
      permissionState: "granted",
      trackEnded: true,
    }),
    null,
  );
  assert.equal(
    dictateDropFromStop({
      userStop: false,
      already: null,
      permissionState: "denied",
      trackEnded: true,
    }),
    "permission",
  );
  assert.equal(
    dictateDropFromStop({
      userStop: false,
      already: null,
      permissionState: "granted",
      trackEnded: true,
    }),
    "device",
  );
  assert.equal(
    dictateDropFromStop({
      userStop: false,
      already: "network",
      permissionState: "granted",
      trackEnded: false,
    }),
    "network",
  );
  assert.equal(
    dictateDropFromStop({
      userStop: false,
      already: null,
      permissionState: null,
      trackEnded: false,
      recorderErrorName: "SecurityError",
    }),
    "permission",
  );
});

test("listeners report a live mic drop and then detach", () => {
  const mic = track();
  const rec = recorder();
  const perm = permission("granted");
  const drops: DictateDrop[] = [];
  const states: string[] = [];
  const errors: Array<string | null> = [];
  const stop = bindDictateDrop({
    tracks: [mic],
    recorder: rec,
    permission: perm,
    onDrop: (drop) => drops.push(drop),
    onPermissionState: (state) => states.push(state),
    onRecorderError: (name) => errors.push(name),
  });

  mic.emit();
  assert.deepEqual(drops, ["device"]);

  perm.state = "denied";
  perm.emit();
  assert.deepEqual(states, ["denied"]);
  assert.deepEqual(drops, ["device", "permission"]);

  rec.emit({ name: "NetworkError" });
  assert.deepEqual(errors, ["NetworkError"]);
  assert.equal(drops.at(-1), "network");

  rec.emit({ name: "NotReadableError" });
  assert.equal(drops.at(-1), "device");

  rec.emit({});
  assert.equal(drops.at(-1), "device");
  assert.equal(errors.at(-1), null);

  stop();
  assert.equal(mic.size(), 0);
  assert.equal(rec.size(), 0);
  assert.equal(perm.size(), 0);
  mic.emit();
  perm.emit();
  rec.emit({ name: "SecurityError" });
  assert.equal(drops.length, 5);
});

test("dictate failure UI keeps Retry and Hear this, and empty stays a status", () => {
  const banner = readFileSync(
    new URL("../components/DictateFieldBanner.tsx", import.meta.url),
    "utf8",
  );
  const button = readFileSync(
    new URL("../components/DictationButton.tsx", import.meta.url),
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
  assert.match(errorCard, />\s*Retry\s*</);
  assert.match(sheet, /min-h-12 w-full/);
  assert.match(emptyCard, /role="status"/);
  assert.match(emptyCard, /Hear this/);
  assert.doesNotMatch(emptyCard, /Retry/);
  assert.doesNotMatch(emptyCard, /role="alert"/);
  assert.match(button, /DictateFieldBanner/);
  assert.match(button, /DictateEmptyState/);
  assert.match(button, /bindDictateDrop/);
  assert.match(button, /shouldAutoRetryDictate/);
  assert.doesNotMatch(button, /VoiceFeedback/);
  assert.equal(
    [banner, button].join("\n").includes("SUPABASE_SERVICE_ROLE"),
    false,
  );
});
