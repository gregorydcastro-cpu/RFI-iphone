import { isXaiConfigured } from "@/lib/xai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Whether `process.env.XAI_API_KEY` is set for Grok STT/TTS.
 * Never returns the key. Production (Vercel project gc-field-log)
 * needs this env for live mic / read-aloud.
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
