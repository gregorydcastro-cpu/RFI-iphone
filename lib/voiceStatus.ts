"use client";

export type VoiceStatus = {
  ok: boolean;
  configured: boolean;
  provider?: string;
};

let cached: VoiceStatus | null = null;
let pending: Promise<VoiceStatus> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeVoiceStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getVoiceStatusSnapshot(): VoiceStatus | null {
  return cached;
}

export function getVoiceStatusServerSnapshot(): VoiceStatus | null {
  return null;
}

export async function loadVoiceStatus(): Promise<VoiceStatus> {
  if (cached) return cached;
  if (!pending) {
    pending = fetch("/api/voice/status", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as Partial<VoiceStatus>;
        cached = {
          ok: data.ok !== false,
          configured: Boolean(data.configured),
          provider: typeof data.provider === "string" ? data.provider : "xai",
        };
        emit();
        return cached;
      })
      .catch(() => {
        cached = { ok: false, configured: false };
        emit();
        return cached;
      });
  }
  return pending;
}
