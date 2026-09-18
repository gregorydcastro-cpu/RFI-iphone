import { isXaiConfigured } from "@/lib/xai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Whether server-side Grok Voice (STT/TTS) is configured.
 * Never returns the key.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      configured: isXaiConfigured(),
      provider: "xai",
      stt: "/api/dictation",
      tts: "/api/tts",
    },
    { headers: NO_STORE },
  );
}
