"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getReadAloudServerSnapshot,
  getReadAloudSnapshot,
  speakAloud,
  stopAloud,
  subscribeReadAloud,
} from "@/lib/readAloudStore";
import { loadVoiceStatus } from "@/lib/voiceStatus";

type Props = {
  id: string;
  text: string;
  label?: string;
  disabled?: boolean;
  className?: string;
};

function SpeakerIcon({ mode }: { mode: "idle" | "loading" | "playing" }) {
  if (mode === "loading") {
    return (
      <span
        className="inline-block size-5 animate-spin rounded-full border-2 border-tan border-t-cta"
        aria-hidden
      />
    );
  }
  if (mode === "playing") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-current">
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-none stroke-current stroke-2">
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4z" />
      <path d="M15.5 9.5a3.2 3.2 0 0 1 0 5" />
      <path d="M17.5 7.5a6 6 0 0 1 0 9" />
    </svg>
  );
}

/**
 * Ghost speaker for Grok batch TTS. One utterance at a time.
 * Speaker icon is reserved for read-aloud (mic is dictation).
 */
export function ReadAloudButton({
  id,
  text,
  label = "Read aloud",
  disabled = false,
  className = "",
}: Props) {
  const player = useSyncExternalStore(
    subscribeReadAloud,
    getReadAloudSnapshot,
    getReadAloudServerSnapshot,
  );

  useEffect(() => {
    void loadVoiceStatus();
  }, []);

  const active = player.id === id;
  const mode = active ? player.status : "idle";
  const busy = Boolean(text.trim()) && !disabled;
  const buttonLabel =
    mode === "loading" ? "Loading…" : mode === "playing" ? "Stop" : label;

  async function onClick() {
    if (!busy) return;
    if (mode === "playing" || mode === "loading") {
      stopAloud();
      return;
    }
    await speakAloud(id, text);
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={!busy}
        aria-pressed={mode === "playing"}
        aria-label={buttonLabel}
        className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-2 border px-4 text-sm font-semibold tracking-wide uppercase ${
          mode === "playing"
            ? "border-cta bg-cta text-secondary"
            : "border-line bg-ink text-secondary hover:border-cta hover:bg-panel-2"
        } disabled:opacity-60`}
      >
        <SpeakerIcon mode={mode} />
        <span>{buttonLabel}</span>
      </button>
      {active && player.error ? (
        <p role="alert" className="mt-2 text-sm text-cta">
          {player.error}
        </p>
      ) : null}
    </div>
  );
}
