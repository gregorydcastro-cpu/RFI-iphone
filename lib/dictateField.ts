/**
 * Field copy for a dictate session that drops mid-take.
 * Mic permission lost, the microphone gone, or the network drops while saving.
 * Short title, short message. An empty clip is a status.
 * A dropped take is an alert with Retry. One automatic retry for a fast
 * network drop, then the banner. No keys, no raw fetch text.
 */

import {
  canRetrySameAudio,
  voiceErrorMessage,
  type VoiceErrorCode,
} from "./voiceErrors.ts";
import { type VoiceEmptyKind } from "./voiceEmpty.ts";

/** One extra attempt after a fast network drop while saving the clip. */
export const DICTATE_ATTEMPTS = 2;
export const DICTATE_BACKOFF_MS = 400;

export const DICTATE_DROPS = ["permission", "device", "network"] as const;

export type DictateDrop = (typeof DICTATE_DROPS)[number];

export const DICTATE_NETWORK_TITLE = "Dictation did not finish";
export const DICTATE_NETWORK_MESSAGE = "Shaky signal. Tap Retry.";

export const DICTATE_PERMISSION_TITLE = "Mic permission dropped";
export const DICTATE_PERMISSION_MESSAGE =
  "The mic permission dropped. Tap Retry.";

export const DICTATE_DEVICE_TITLE = "Mic dropped";
export const DICTATE_DEVICE_MESSAGE = "The microphone is gone. Tap Retry.";

const PERMISSION_NAMES = new Set([
  "NotAllowedError",
  "PermissionDeniedError",
  "SecurityError",
]);

const DEVICE_NAMES = new Set([
  "NotFoundError",
  "NotReadableError",
  "OverconstrainedError",
  "AbortError",
  "InvalidStateError",
]);

const EMPTY_COPY: Record<
  Exclude<VoiceEmptyKind, "idle" | "unread">,
  { title: string; message: string }
> = {
  denied: {
    title: "Mic is off",
    message: "Allow it, then tap the mic.",
  },
  missing: {
    title: "No microphone",
    message: "Mic is not available.",
  },
  silent: {
    title: "Nothing heard",
    message: "Tap the mic and speak.",
  },
};

export type DictateBanner = {
  title: string;
  message: string;
  speak: string;
  retrySameAudio: boolean;
};

export type DictateFieldSurface =
  | { kind: "ready" }
  | { kind: "listening" }
  | { kind: "saving" }
  | { kind: "heard"; text: string }
  | { kind: "empty"; title: string; message: string; speak: string }
  | ({ kind: "error" } & DictateBanner);

export type DictateTrack = {
  addEventListener(type: "ended", listener: () => void): void;
  removeEventListener(type: "ended", listener: () => void): void;
};

export type DictateRecorder = {
  addEventListener(
    type: "error",
    listener: (event: { error?: unknown }) => void,
  ): void;
  removeEventListener(
    type: "error",
    listener: (event: { error?: unknown }) => void,
  ): void;
};

export type DictatePermission = {
  state: string;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
};

function speak(title: string, message: string): string {
  return `${title}. ${message}`;
}

export function dictateErrorName(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("name" in error)) return null;
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" && name.trim() ? name : null;
}

export function dictateDropFromName(name: string | null | undefined): DictateDrop | null {
  if (!name) return null;
  if (PERMISSION_NAMES.has(name)) return "permission";
  if (name === "NetworkError") return "network";
  if (DEVICE_NAMES.has(name)) return "device";
  return null;
}

/** Track ended mid-take. Denied permission is not a missing device. */
export function dictateDropFromTrackEnd(
  permissionState: string | null | undefined,
): "permission" | "device" {
  if (permissionState === "denied") return "permission";
  return "device";
}

/**
 * Why onstop fired. A glove tap is a normal stop. A track that died
 * first, or a recorder error, is a drop.
 */
export function dictateDropFromStop(input: {
  userStop: boolean;
  already: DictateDrop | null;
  permissionState: string | null;
  trackEnded: boolean;
  recorderErrorName?: string | null;
}): DictateDrop | null {
  if (input.already) return input.already;
  if (input.userStop) return null;
  if (input.recorderErrorName) {
    return dictateDropFromName(input.recorderErrorName) ?? "device";
  }
  if (input.permissionState === "denied") return "permission";
  if (input.trackEnded) return "device";
  return null;
}

export function dictateDropBanner(drop: DictateDrop): DictateBanner {
  if (drop === "permission") {
    return {
      title: DICTATE_PERMISSION_TITLE,
      message: DICTATE_PERMISSION_MESSAGE,
      speak: speak(DICTATE_PERMISSION_TITLE, DICTATE_PERMISSION_MESSAGE),
      retrySameAudio: false,
    };
  }
  if (drop === "device") {
    return {
      title: DICTATE_DEVICE_TITLE,
      message: DICTATE_DEVICE_MESSAGE,
      speak: speak(DICTATE_DEVICE_TITLE, DICTATE_DEVICE_MESSAGE),
      retrySameAudio: false,
    };
  }
  return {
    title: DICTATE_NETWORK_TITLE,
    message: DICTATE_NETWORK_MESSAGE,
    speak: speak(DICTATE_NETWORK_TITLE, DICTATE_NETWORK_MESSAGE),
    retrySameAudio: true,
  };
}

const NETWORK_CODES = new Set<VoiceErrorCode>(["unreachable", "timeout"]);

/**
 * The save call never left the phone, or the voice route was a dead connection.
 * Busy, a bad clip, and voice-off stay their own banners.
 */
export function dictateNetworkFromVoice(input: {
  thrown?: boolean;
  offline?: boolean;
  code?: string | null;
  httpStatus?: number;
}): boolean {
  if (input.offline || input.thrown) return true;
  if (input.code && NETWORK_CODES.has(input.code as VoiceErrorCode)) return true;
  const status = input.httpStatus;
  if (status == null) return false;
  if (status === 0 || status === 408 || status === 504) return true;
  if (status === 502 && input.code !== "rejected") return true;
  return false;
}

export function dictateVoiceBanner(code: VoiceErrorCode): DictateBanner {
  if (dictateNetworkFromVoice({ code })) return dictateDropBanner("network");
  const titles: Record<VoiceErrorCode, string> = {
    unconfigured: "Voice is off",
    rejected: "Voice key rejected",
    busy: "Voice is busy",
    unreachable: DICTATE_NETWORK_TITLE,
    timeout: DICTATE_NETWORK_TITLE,
    too_large: "Audio is too large",
    bad_input: "Audio not usable",
    no_speech: "Nothing heard",
    unknown_voice: "Voice not available",
    failed: "Dictation did not finish",
  };
  const message =
    code === "failed" ? "Voice failed. Tap Retry." : voiceErrorMessage(code);
  const title = titles[code];
  return {
    title,
    message,
    speak: speak(title, message),
    retrySameAudio: canRetrySameAudio(code),
  };
}

export function dictateEmptyCard(
  kind: VoiceEmptyKind,
): { title: string; message: string; speak: string } | null {
  if (kind === "idle" || kind === "unread") return null;
  const copy = EMPTY_COPY[kind];
  return {
    title: copy.title,
    message: copy.message,
    speak: speak(copy.title, copy.message),
  };
}

export function dictateFieldSurface(input: {
  recording?: boolean;
  pending?: boolean;
  heard?: string | null;
  emptyKind?: VoiceEmptyKind;
  drop?: DictateDrop | null;
  errorCode?: VoiceErrorCode | null;
}): DictateFieldSurface {
  if (input.recording) return { kind: "listening" };
  if (input.pending) return { kind: "saving" };
  if (input.drop) return { kind: "error", ...dictateDropBanner(input.drop) };
  if (input.errorCode === "no_speech") {
    const empty = dictateEmptyCard("silent");
    if (empty) return { kind: "empty", ...empty };
  }
  if (input.errorCode) return { kind: "error", ...dictateVoiceBanner(input.errorCode) };
  const heard = input.heard?.trim() ?? "";
  if (heard) return { kind: "heard", text: heard };
  const empty = dictateEmptyCard(input.emptyKind ?? "idle");
  if (empty) return { kind: "empty", ...empty };
  return { kind: "ready" };
}

export function shouldAutoRetryDictate(input: {
  attempt: number;
  attempts?: number;
  network?: boolean;
  drop?: DictateDrop | null;
}): boolean {
  const attempts = input.attempts ?? DICTATE_ATTEMPTS;
  if (input.attempt >= attempts - 1) return false;
  if (input.drop === "permission" || input.drop === "device") return false;
  return input.network === true || input.drop === "network";
}

/**
 * Hear track end, a recorder error, and a permission change while the mic is open.
 * The caller stops the recorder. Cleanup removes the listeners.
 */
export function bindDictateDrop(input: {
  tracks: readonly DictateTrack[];
  recorder: DictateRecorder;
  permission?: DictatePermission | null;
  onDrop: (drop: DictateDrop) => void;
  onPermissionState?: (state: string) => void;
  onRecorderError?: (name: string | null) => void;
}): () => void {
  let closed = false;
  const tracks = input.tracks;
  const permission = input.permission ?? null;

  const onEnded = () => {
    if (closed) return;
    input.onDrop(dictateDropFromTrackEnd(permission?.state));
  };
  const onError = (event: { error?: unknown }) => {
    if (closed) return;
    const name = dictateErrorName(event.error);
    input.onRecorderError?.(name);
    input.onDrop(dictateDropFromName(name) ?? "device");
  };
  const onPermission = () => {
    if (closed || !permission) return;
    input.onPermissionState?.(permission.state);
    if (permission.state === "denied") input.onDrop("permission");
  };

  for (const track of tracks) track.addEventListener("ended", onEnded);
  input.recorder.addEventListener("error", onError);
  permission?.addEventListener("change", onPermission);

  return () => {
    closed = true;
    for (const track of tracks) track.removeEventListener("ended", onEnded);
    input.recorder.removeEventListener("error", onError);
    permission?.removeEventListener("change", onPermission);
  };
}
