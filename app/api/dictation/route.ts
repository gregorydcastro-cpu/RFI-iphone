import { readXaiApiKey, FIELD_STT_KEYTERMS, XAI_STT_MODEL, XAI_STT_URL } from "@/lib/xai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BYTES = 8 * 1024 * 1024;

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
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

/**
 * Batch Grok STT. Browser posts MediaRecorder audio; this route holds XAI_API_KEY
 * and forwards multipart to https://api.x.ai/v1/stt. Option fields first, file last.
 */
export async function POST(request: Request) {
  const key = readXaiApiKey();
  if (!key) {
    return json(
      {
        ok: false,
        error: "XAI_API_KEY is not configured on the server.",
        configured: false,
      },
      503,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Expected multipart form audio." }, 400);
  }

  const uploaded = form.get("file");
  if (!(uploaded instanceof Blob) || uploaded.size < 1) {
    return json({ ok: false, error: "file is required" }, 400);
  }
  if (uploaded.size > MAX_BYTES) {
    return json({ ok: false, error: "Audio is too large (max 8 MB)." }, 413);
  }

  const filename = asFileName(uploaded, "dictation");
  const keyterms = [...FIELD_STT_KEYTERMS, ...extraKeyterms(form)].slice(0, 100);

  const upstream = new FormData();
  upstream.append("model", XAI_STT_MODEL);
  upstream.append("format", "true");
  upstream.append("language", "en");
  for (const term of keyterms) {
    upstream.append("keyterm", term);
  }
  upstream.append("file", uploaded, filename);

  let response: Response;
  try {
    response = await fetch(XAI_STT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
    });
  } catch {
    return json({ ok: false, error: "Could not reach Grok speech-to-text." }, 502);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 401) {
      return json({ ok: false, error: "Voice API key was rejected." }, 502);
    }
    if (status === 429) {
      return json({ ok: false, error: "Voice is busy. Try again in a moment." }, 429);
    }
    if (status === 413) {
      return json({ ok: false, error: "Audio is too large for transcription." }, 413);
    }
    return json(
      { ok: false, error: `Speech-to-text failed (${status}).` },
      status >= 400 && status < 500 ? 400 : 502,
    );
  }

  const data = (await response.json()) as { text?: unknown; language?: unknown };
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (!text) {
    return json({ ok: false, error: "No speech recognized. Try again." }, 422);
  }

  return json({
    ok: true,
    text,
    language: typeof data.language === "string" ? data.language : "en",
  });
}
