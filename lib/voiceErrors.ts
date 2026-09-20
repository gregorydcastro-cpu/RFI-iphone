/**
 * Shared voice error codes for STT / TTS / status.
 * Safe for the client bundle — no keys, no env reads.
 */

export const VOICE_ERROR_CODES = [
  "unconfigured",
  "rejected",
  "busy",
  "unreachable",
  "timeout",
  "too_large",
  "bad_input",
  "no_speech",
  "unknown_voice",
  "failed",
] as const;

export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[number];

export const VOICE_ERROR_MESSAGES: Record<VoiceErrorCode, string> = {
  unconfigured:
    "Voice is off on the server. Mic and read-aloud will not work until the server voice key is set.",
  rejected: "Voice key was rejected. Tap retry after the server key is fixed.",
  busy: "Voice is busy. Tap retry in a moment.",
  unreachable: "Could not reach voice. Check the connection and tap retry.",
  timeout: "Voice timed out. Tap retry.",
  too_large: "Audio is too large. Tap mic and speak a shorter clip.",
  bad_input: "Voice could not use that audio. Tap mic and try again.",
  no_speech: "No speech heard. Tap mic, speak, then tap stop.",
  unknown_voice: "That voice is not available. Tap retry.",
  failed: "Voice failed. Tap retry.",
};

const RETRY_SAME_AUDIO: ReadonlySet<VoiceErrorCode> = new Set([
  "busy",
  "unreachable",
  "timeout",
  "failed",
  "rejected",
]);

export function isVoiceErrorCode(value: unknown): value is VoiceErrorCode {
  return (
    typeof value === "string" &&
    (VOICE_ERROR_CODES as readonly string[]).includes(value)
  );
}

export function voiceErrorMessage(
  code: VoiceErrorCode | undefined,
  fallback?: string,
): string {
  if (code && VOICE_ERROR_MESSAGES[code]) return VOICE_ERROR_MESSAGES[code];
  if (typeof fallback === "string" && fallback.trim()) return fallback.trim();
  return VOICE_ERROR_MESSAGES.failed;
}

export function canRetrySameAudio(code: VoiceErrorCode | undefined): boolean {
  return Boolean(code && RETRY_SAME_AUDIO.has(code));
}

export type VoiceErrorBody = {
  ok?: boolean;
  error?: string;
  code?: unknown;
  configured?: boolean;
};

export function mapVoiceHttpStatus(status: number): VoiceErrorCode {
  if (status === 503) return "unconfigured";
  if (status === 401) return "rejected";
  if (status === 429) return "busy";
  if (status === 413) return "too_large";
  if (status === 404) return "unknown_voice";
  if (status === 408 || status === 504) return "timeout";
  if (status === 422) return "no_speech";
  if (status === 400) return "bad_input";
  if (status === 502) return "unreachable";
  return "failed";
}

export function parseVoiceErrorBody(
  data: unknown,
  status: number,
): {
  code: VoiceErrorCode;
  message: string;
  configured?: boolean;
} {
  const body = data && typeof data === "object" ? (data as VoiceErrorBody) : {};
  const code = isVoiceErrorCode(body.code)
    ? body.code
    : body.configured === false || status === 503
      ? "unconfigured"
      : mapVoiceHttpStatus(status);
  return {
    code,
    message: voiceErrorMessage(
      code,
      typeof body.error === "string" ? body.error : undefined,
    ),
    configured: typeof body.configured === "boolean" ? body.configured : undefined,
  };
}

export type VoiceStatusPayload = {
  ok: boolean;
  configured: boolean;
  provider?: string;
  code?: VoiceErrorCode;
  error?: string;
};

export function parseVoiceStatusPayload(data: unknown): VoiceStatusPayload {
  const body = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  return {
    ok: body.ok !== false,
    configured: Boolean(body.configured),
    provider: typeof body.provider === "string" ? body.provider : "xai",
    code: isVoiceErrorCode(body.code) ? body.code : undefined,
    error: typeof body.error === "string" ? body.error : undefined,
  };
}
