"use client";

import { useEffect, useSyncExternalStore } from "react";
import { VoiceFeedback } from "@/components/VoiceFeedback";
import {
  getReadAloudServerSnapshot,
  getReadAloudSnapshot,
  speakAloud,
  stopAloud,
  subscribeReadAloud,
} from "@/lib/readAloudStore";
import { voiceErrorMessage } from "@/lib/voiceErrors";
import {
  getVoiceStatusServerSnapshot,
  getVoiceStatusSnapshot,
  loadVoiceStatus,
  refreshVoiceStatus,
  subscribeVoiceStatus,
  voiceStatusBlocksMic,
} from "@/lib/voiceStatus";

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
  const voice = useSyncExternalStore(
    subscribeVoiceStatus,
    getVoiceStatusSnapshot,
    getVoiceStatusServerSnapshot,
  );

  useEffect(() => {
    void loadVoiceStatus();
  }, []);

  const active = player.id === id;
  const mode = active ? player.status : "idle";
  const blocked = voiceStatusBlocksMic(voice);
  const busy = Boolean(text.trim()) && !disabled && !blocked;
  const buttonLabel =
    mode === "loading" ? "Loading…" : mode === "playing" ? "Stop" : label;
  const error = active ? player.error : null;

  async function onClick() {
    if (blocked) return;
    if (!busy && mode === "idle") return;
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
        disabled={!busy && mode === "idle"}
        aria-pressed={mode === "playing"}
        aria-label={buttonLabel}
        className={`inline-flex min-h-14 min-w-14 items-center justify-center gap-2 border px-4 text-sm font-semibold tracking-wide uppercase ${
          mode === "playing"
            ? "border-cta bg-cta text-secondary"
            : "border-line bg-ink text-secondary hover:border-cta hover:bg-panel-2"
        } disabled:opacity-60`}
      >
        <SpeakerIcon mode={mode} />
        <span>{buttonLabel}</span>
      </button>
      {error ? (
        <VoiceFeedback
          className="mt-3"
          title={player.errorCode === "unconfigured" ? "Voice is off" : "Read-aloud failed"}
          message={error || voiceErrorMessage(player.errorCode ?? undefined)}
          onRetry={() => {
            void (async () => {
              if (player.errorCode === "unconfigured") {
                const next = await refreshVoiceStatus();
                if (voiceStatusBlocksMic(next)) return;
              }
              await speakAloud(id, text);
            })();
          }}
          retryLabel="Retry"
        />
      ) : null}
    </div>
  );
}
