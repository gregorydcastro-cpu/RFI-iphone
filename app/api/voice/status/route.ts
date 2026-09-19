import { voiceErrorMessage } from "@/lib/voiceErrors";
import { isXaiConfigured } from "@/lib/xai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const PATHS = {
  provider: "xai" as const,
  stt: "/api/dictation",
  tts: "/api/tts",
};

/**
 * Whether server-side Grok Voice (STT/TTS) is configured.
 * Never returns the key or any env value.
 */
export async function GET() {
  try {
    return NextResponse.json(
      {
        ok: true,
        configured: isXaiConfigured(),
        ...PATHS,
      },
      { headers: NO_STORE },
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        ...PATHS,
        error: voiceErrorMessage("failed"),
        code: "failed",
      },
      { status: 200, headers: NO_STORE },
    );
  }
}
