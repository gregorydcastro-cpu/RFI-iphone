"use client";

export type ReadAloudStatus = "idle" | "loading" | "playing";

export type ReadAloudState = {
  id: string | null;
  status: ReadAloudStatus;
  error: string | null;
};

let state: ReadAloudState = { id: null, status: "idle", error: null };
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
  return { id: null, status: "idle", error: null };
}

export function stopAloud() {
  playToken += 1;
  releaseAudio();
  setState({ id: null, status: "idle", error: null });
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
  setState({ id, status: "loading", error: null });

  try {
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: "en" }),
    });
    if (token !== playToken) return;
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string; configured?: boolean }
        | null;
      const fallback =
        response.status === 503 || data?.configured === false
          ? "Voice is not configured on the server."
          : "Could not read aloud.";
      throw new Error(
        response.status === 503 || data?.configured === false
          ? fallback
          : (data?.error ?? fallback),
      );
    }
    const blob = await response.blob();
    if (token !== playToken) return;
    const url = URL.createObjectURL(blob);
    currentUrl = url;
    audio.src = url;
    audio.addEventListener(
      "ended",
      () => {
        if (token !== playToken) return;
        releaseAudio();
        setState({ id: null, status: "idle", error: null });
      },
      { once: true },
    );
    setState({ id, status: "playing", error: null });
    await audio.play();
  } catch (error) {
    if (token !== playToken) return;
    releaseAudio();
    const message = error instanceof Error ? error.message : "Could not read aloud.";
    setState({ id, status: "idle", error: message });
  }
}
