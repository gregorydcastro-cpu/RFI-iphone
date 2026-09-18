import { prepareSpeakText, TTS_MAX_CHARS } from "@/lib/speakText";
import {
  isVoiceId,
  readXaiApiKey,
  XAI_TTS_LANGUAGE,
  XAI_TTS_URL,
  XAI_TTS_VOICE,
} from "@/lib/xai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

type TtsBody = {
  text?: unknown;
  voice_id?: unknown;
  language?: unknown;
};

/**
 * Batch Grok TTS. Returns MP3. XAI_API_KEY never leaves the server.
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

  let body: TtsBody;
  try {
    body = (await request.json()) as TtsBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const raw = typeof body.text === "string" ? body.text : "";
  const text = prepareSpeakText(raw);
  if (!text) {
    return json({ ok: false, error: "text is required" }, 400);
  }
  if (text.length > TTS_MAX_CHARS) {
    return json(
      { ok: false, error: `TTS text must be 1–${TTS_MAX_CHARS} characters.` },
      400,
    );
  }

  const voiceId =
    typeof body.voice_id === "string" && isVoiceId(body.voice_id.trim())
      ? body.voice_id.trim()
      : XAI_TTS_VOICE;
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : XAI_TTS_LANGUAGE;

  let response: Response;
  try {
    response = await fetch(XAI_TTS_URL, {
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
    });
  } catch {
    return json({ ok: false, error: "Could not reach Grok text-to-speech." }, 502);
  }

  if (!response.ok) {
    const status = response.status;
    if (status === 404) {
      return json({ ok: false, error: "Unknown voice." }, 404);
    }
    if (status === 401) {
      return json({ ok: false, error: "Voice API key was rejected." }, 502);
    }
    if (status === 422) {
      return json({ ok: false, error: "TTS request was missing a required field." }, 400);
    }
    if (status === 429) {
      return json({ ok: false, error: "Voice is busy. Try again in a moment." }, 429);
    }
    return json(
      { ok: false, error: `Text-to-speech failed (${status}).` },
      status >= 400 && status < 500 ? 400 : 502,
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
