import { voiceErrorMessage } from "@/lib/voiceErrors";
import {
  fetchXaiWithRetry,
  mapUpstreamVoiceError,
  parseRetryAfterMs,
  VOICE_RETRY_MAX_WAIT_MS,
} from "@/lib/xaiUpstream";
import { readXaiApiKey, FIELD_STT_KEYTERMS, XAI_STT_MODEL, XAI_STT_URL } from "@/lib/xai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BYTES = 8 * 1024 * 1024;

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

function asFileName(file: Blob, fallback: string): string {
  if (file instanceof File && file.name.trim()) return file.name;
  const type = file.type || "";
  if (type.includes("webm")) return "dictation.webm";
  if (type.includes("mp4") || type.includes("m4a")) return "dictation.m4a";
  if (type.includes("mpeg") || type.includes("mp3")) return "dictation.mp3";
  if (type.includes("wav")) return "dictation.wav";
  if (type.includes("ogg")) return "dictation.ogg";
  return fallback;
}

function extraKeyterms(form: FormData): string[] {
  const extra: string[] = [];
  for (const value of form.getAll("keyterm")) {
    if (typeof value !== "string") continue;
    const term = value.trim().slice(0, 50);
    if (term) extra.push(term);
  }
  return extra;
}

function buildSttForm(uploaded: Blob, filename: string, keyterms: string[]) {
  const upstream = new FormData();
  upstream.append("model", XAI_STT_MODEL);
  upstream.append("format", "true");
  upstream.append("language", "en");
  for (const term of keyterms) {
    upstream.append("keyterm", term);
  }
  upstream.append("file", uploaded, filename);
  return upstream;
}

/**
 * Batch Grok STT. Browser posts MediaRecorder audio; this route holds XAI_API_KEY
 * and forwards multipart to https://api.x.ai/v1/stt. Option fields first, file last.
 * Retries safe upstream 429/5xx and network failures. Never returns the key.
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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json(
      { ok: false, error: voiceErrorMessage("bad_input"), code: "bad_input" },
      400,
    );
  }

  const uploaded = form.get("file");
  if (!(uploaded instanceof Blob) || uploaded.size < 1) {
    return json(
      { ok: false, error: voiceErrorMessage("bad_input"), code: "bad_input" },
      400,
    );
  }
  if (uploaded.size > MAX_BYTES) {
    return json(
      { ok: false, error: voiceErrorMessage("too_large"), code: "too_large" },
      413,
    );
  }

  const filename = asFileName(uploaded, "dictation");
  const keyterms = [...FIELD_STT_KEYTERMS, ...extraKeyterms(form)].slice(0, 100);

  const result = await fetchXaiWithRetry(() => ({
    url: XAI_STT_URL,
    init: {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: buildSttForm(uploaded, filename, keyterms),
    },
  }));

  if (!result.ok) {
    const code = result.kind === "timeout" ? "timeout" : "unreachable";
    return json(
      { ok: false, error: voiceErrorMessage(code), code },
      result.kind === "timeout" ? 504 : 502,
    );
  }

  const response = result.response;
  if (!response.ok) {
    const mapped = mapUpstreamVoiceError(response.status, "stt");
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

  let data: { text?: unknown; language?: unknown };
  try {
    data = (await response.json()) as { text?: unknown; language?: unknown };
  } catch {
    return json(
      { ok: false, error: voiceErrorMessage("failed"), code: "failed" },
      502,
    );
  }

  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) {
    return json(
      { ok: false, error: voiceErrorMessage("no_speech"), code: "no_speech" },
      422,
    );
  }

  return json({
    ok: true,
    text,
    language: typeof data.language === "string" ? data.language : "en",
  });
}
