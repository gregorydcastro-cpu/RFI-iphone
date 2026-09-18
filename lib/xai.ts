import { readEnv } from "@/lib/env";

/** Official xAI HTTP endpoints. Key stays on the server. */
export const XAI_STT_URL = "https://api.x.ai/v1/stt";
export const XAI_TTS_URL = "https://api.x.ai/v1/tts";

export const XAI_STT_MODEL = "grok-voice-transcribe-2.0";
export const XAI_TTS_VOICE = "eve";
export const XAI_TTS_LANGUAGE = "en";

const VOICE_ID_RE = /^[a-z0-9-]{1,64}$/i;

/**
 * Server-only xAI key for Grok STT/TTS. Exact Vercel Production key
 * on project **gc-field-log**:
 *
 *   process.env.XAI_API_KEY
 *
 * Never `NEXT_PUBLIC_`. Bracket access via `readEnv` so Next.js does not
 * inline the secret at build time. This app talks to api.x.ai from
 * `/api/dictation` and `/api/tts` only.
 */
export function readXaiApiKey(): string | undefined {
  return readEnv("XAI_API_KEY");
}

export function isXaiConfigured(): boolean {
  return Boolean(readXaiApiKey());
}

export function isVoiceId(value: string): boolean {
  return VOICE_ID_RE.test(value);
}

/** Field jargon to bias STT. Each term ≤50 chars, ≤100 total. */
export const FIELD_STT_KEYTERMS = [
  "RFI",
  "Maple Point",
  "Maple Point Medical Office",
  "Electrical Closet",
  "PP-101",
  "panelboard",
  "junction box",
  "duplex receptacle",
  "lighting control relay",
  "Pat Nguyen",
  "takeoff",
  "room pack",
  "A-101",
  "E-101",
  "E-102",
  "foreman",
] as const;
