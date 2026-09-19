import { prepareSpeakText, TTS_MAX_CHARS } from "@/lib/speakText";
import { voiceErrorMessage } from "@/lib/voiceErrors";
import {
  fetchXaiWithRetry,
  mapUpstreamVoiceError,
  parseRetryAfterMs,
  VOICE_RETRY_MAX_WAIT_MS,
} from "@/lib/xaiUpstream";
import {
  isVoiceId,
  normalizeTtsLanguage,
  readXaiApiKey,
  XAI_TTS_URL,
  XAI_TTS_VOICE,
} from "@/lib/xai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

function json(
  data: unknown,
  status = 200,
  extra?: Record<string, string>,
) {
  return NextResponse.json(data, {
    status,
    headers: { ...NO_STORE, ...extra },
  });
}

type TtsBody = {
  text?: unknown;
  voice_id?: unknown;
  language?: unknown;
};

function ttsInit(key: string, text: string, voiceId: string, language: string): RequestInit {
  return {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      language,
      text_normalization: true,
    }),
  };
}

/**
 * Batch Grok TTS. Returns MP3. XAI_API_KEY never leaves the server.
 * Retries safe 429/5xx. Unknown custom voice falls back to the default voice.
 */
export async function POST(request: Request) {
  const key = readXaiApiKey();
  if (!key) {
    return json(
      {
        ok: false,
        error: voiceErrorMessage("unconfigured"),
        code: "unconfigured",
        configured: false,
      },
      503,
    );
  }

  let body: TtsBody;
  try {
    body = (await request.json()) as TtsBody;
  } catch {
    return json(
      { ok: false, error: voiceErrorMessage("bad_input"), code: "bad_input" },
      400,
    );
  }

  const raw = typeof body.text === "string" ? body.text : "";
  const text = prepareSpeakText(raw);
  if (!text) {
    return json(
      { ok: false, error: voiceErrorMessage("bad_input"), code: "bad_input" },
      400,
    );
  }
  if (text.length > TTS_MAX_CHARS) {
    return json(
      { ok: false, error: voiceErrorMessage("bad_input"), code: "bad_input" },
      400,
    );
  }

  const requestedVoice =
    typeof body.voice_id === "string" && isVoiceId(body.voice_id.trim())
      ? body.voice_id.trim()
      : XAI_TTS_VOICE;
  const language = normalizeTtsLanguage(
    typeof body.language === "string" ? body.language : undefined,
  );

  let result = await fetchXaiWithRetry(() => ({
    url: XAI_TTS_URL,
    init: ttsInit(key, text, requestedVoice, language),
  }));

  if (
    result.ok &&
    result.response.status === 404 &&
    requestedVoice.toLowerCase() !== XAI_TTS_VOICE
  ) {
    result = await fetchXaiWithRetry(() => ({
      url: XAI_TTS_URL,
      init: ttsInit(key, text, XAI_TTS_VOICE, language),
    }));
  }

  if (!result.ok) {
    const code = result.kind === "timeout" ? "timeout" : "unreachable";
    return json(
      { ok: false, error: voiceErrorMessage(code), code },
      result.kind === "timeout" ? 504 : 502,
    );
  }

  const response = result.response;
  if (!response.ok) {
    const mapped = mapUpstreamVoiceError(response.status, "tts");
    const extra: Record<string, string> = {};
    if (mapped.code === "busy") {
      const retryAfter = parseRetryAfterMs(response.headers.get("retry-after"));
      if (retryAfter != null && retryAfter <= VOICE_RETRY_MAX_WAIT_MS) {
        extra["Retry-After"] = String(Math.max(1, Math.ceil(retryAfter / 1000)));
      }
    }
    return json(
      { ok: false, error: voiceErrorMessage(mapped.code), code: mapped.code },
      mapped.status,
      extra,
    );
  }

  if (!response.body) {
    return json(
      { ok: false, error: voiceErrorMessage("failed"), code: "failed" },
      502,
    );
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
