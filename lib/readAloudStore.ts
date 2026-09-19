"use client";

import {
  parseVoiceErrorBody,
  voiceErrorMessage,
  type VoiceErrorCode,
} from "@/lib/voiceErrors";
import { markVoiceUnconfigured } from "@/lib/voiceStatus";

export type ReadAloudStatus = "idle" | "loading" | "playing";

export type ReadAloudState = {
  id: string | null;
  status: ReadAloudStatus;
  error: string | null;
  errorCode: VoiceErrorCode | null;
};

let state: ReadAloudState = {
  id: null,
  status: "idle",
  error: null,
  errorCode: null,
};
const listeners = new Set<() => void>();
let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;
let playToken = 0;

function emit() {
  for (const listener of listeners) listener();
}

function setState(patch: Partial<ReadAloudState>) {
  state = { ...state, ...patch };
  emit();
}

function releaseAudio() {
  currentAudio?.pause();
  currentAudio = null;
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

export function subscribeReadAloud(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getReadAloudSnapshot(): ReadAloudState {
  return state;
}

export function getReadAloudServerSnapshot(): ReadAloudState {
  return { id: null, status: "idle", error: null, errorCode: null };
}

export function stopAloud() {
  playToken += 1;
  releaseAudio();
  setState({ id: null, status: "idle", error: null, errorCode: null });
}

export async function speakAloud(id: string, text: string): Promise<void> {
  if (state.id === id && (state.status === "playing" || state.status === "loading")) {
    stopAloud();
    return;
  }

  const token = ++playToken;
  releaseAudio();
  const audio = new Audio();
  currentAudio = audio;
  setState({ id, status: "loading", error: null, errorCode: null });

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "en" }),
    });
    if (token !== playToken) return;
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      const parsed = parseVoiceErrorBody(data, response.status);
      if (parsed.code === "unconfigured") markVoiceUnconfigured();
      throw Object.assign(new Error(parsed.message), { code: parsed.code });
    }
    const blob = await response.blob();
    if (token !== playToken) return;
    if (blob.size < 1) {
      throw Object.assign(new Error(voiceErrorMessage("failed")), { code: "failed" });
    }
    const url = URL.createObjectURL(blob);
    currentUrl = url;
    audio.src = url;
    audio.addEventListener(
      "ended",
      () => {
        if (token !== playToken) return;
        releaseAudio();
        setState({ id: null, status: "idle", error: null, errorCode: null });
      },
      { once: true },
    );
    setState({ id, status: "playing", error: null, errorCode: null });
    await audio.play();
  } catch (error) {
    if (token !== playToken) return;
    releaseAudio();
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: VoiceErrorCode }).code
        : undefined;
    const message =
      error instanceof Error ? error.message : voiceErrorMessage("failed");
    // Keep `id` so the button that failed can show the error.
    setState({
      id,
      status: "idle",
      error: message,
      errorCode: code ?? "failed",
    });
  }
}
