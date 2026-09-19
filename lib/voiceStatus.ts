"use client";

import {
  parseVoiceStatusPayload,
  type VoiceStatusPayload,
} from "@/lib/voiceErrors";

export type VoiceStatus = VoiceStatusPayload;

let cached: VoiceStatus | null = null;
let pending: Promise<VoiceStatus> | null = null;
let loadToken = 0;
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

function applyStatus(status: VoiceStatus, token: number): VoiceStatus {
  if (token !== loadToken) return cached ?? status;
  cached = status;
  emit();
  return status;
}

export async function loadVoiceStatus(): Promise<VoiceStatus> {
  if (cached) return cached;
  if (!pending) {
    const token = ++loadToken;
    pending = fetch("/api/voice/status", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        return applyStatus(parseVoiceStatusPayload(data), token);
      })
      .catch(() =>
        applyStatus(
          {
            ok: false,
            configured: false,
            provider: "xai",
            code: "unreachable",
            error: "Could not check voice.",
          },
          token,
        ),
      )
      .finally(() => {
        if (token === loadToken) pending = null;
      });
  }
  return pending;
}

export async function refreshVoiceStatus(): Promise<VoiceStatus> {
  cached = null;
  pending = null;
  loadToken += 1;
  return loadVoiceStatus();
}

export function markVoiceUnconfigured() {
  cached = {
    ok: true,
    configured: false,
    provider: "xai",
    code: "unconfigured",
  };
  pending = null;
  emit();
}

export function voiceStatusBlocksMic(status: VoiceStatus | null): boolean {
  return Boolean(status?.ok && !status.configured);
}

export function isVoiceCheckFailed(status: VoiceStatus | null): boolean {
  return Boolean(status && status.ok === false);
}
