/**
 * Calm floor copy when voice has nothing to say yet.
 * Not an error banner — mic denial and an empty clip stay short.
 */

export const VOICE_EMPTY_KINDS = [
  "idle",
  "denied",
  "missing",
  "silent",
  "unread",
] as const;

export type VoiceEmptyKind = (typeof VOICE_EMPTY_KINDS)[number];

export const VOICE_EMPTY_COPY: Record<VoiceEmptyKind, string> = {
  idle: "Nothing heard yet.",
  denied: "Mic is off. Allow it, then tap the mic.",
  missing: "Mic is not available.",
  silent: "Nothing heard. Tap the mic and speak.",
  unread: "Nothing to read yet.",
};

const MIC_DENIED = new Set([
  "NotAllowedError",
  "PermissionDeniedError",
  "SecurityError",
]);

const MIC_MISSING = new Set([
  "NotFoundError",
  "NotReadableError",
  "OverconstrainedError",
]);

export function voiceEmptyMessage(kind: VoiceEmptyKind): string {
  return VOICE_EMPTY_COPY[kind];
}

/** Permission or a missing mic. Other failures stay on the error banner. */
export function voiceEmptyKindFromMicError(
  error: unknown,
): "denied" | "missing" | null {
  if (!error || typeof error !== "object" || !("name" in error)) return null;
  const name = String(error.name);
  if (MIC_DENIED.has(name)) return "denied";
  if (MIC_MISSING.has(name)) return "missing";
  return null;
}

/**
 * Empty clip or a no-speech result. A real voice failure (busy, unreachable)
 * returns null so the error banner can show.
 */
export function voiceEmptyKindFromTranscript(input: {
  httpOk: boolean;
  text: string;
  code: string;
}): "silent" | null {
  if (input.text.trim()) return null;
  if (input.httpOk || input.code === "no_speech") return "silent";
  return null;
}
