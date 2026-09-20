"use client";

import { useEffect, useSyncExternalStore } from "react";
import { VoiceFeedback } from "@/components/VoiceFeedback";
import { voiceErrorMessage } from "@/lib/voiceErrors";
import {
  getVoiceStatusServerSnapshot,
  getVoiceStatusSnapshot,
  isVoiceCheckFailed,
  loadVoiceStatus,
  refreshVoiceStatus,
  subscribeVoiceStatus,
  voiceStatusBlocksMic,
} from "@/lib/voiceStatus";

export function VoiceSetupNote({ className = "" }: { className?: string }) {
  const status = useSyncExternalStore(
    subscribeVoiceStatus,
    getVoiceStatusSnapshot,
    getVoiceStatusServerSnapshot,
  );

  useEffect(() => {
    void loadVoiceStatus();
  }, []);

  if (!status) return null;

  if (isVoiceCheckFailed(status)) {
    return (
      <VoiceFeedback
        className={className}
        title="Could not check voice"
        message="Tap check again. Mic and read-aloud may still work."
        onRetry={() => void refreshVoiceStatus()}
        retryLabel="Check again"
      />
    );
  }

  if (!voiceStatusBlocksMic(status)) return null;

  return (
    <VoiceFeedback
      className={className}
      title="Voice is off"
      message={voiceErrorMessage("unconfigured")}
      onRetry={() => void refreshVoiceStatus()}
      retryLabel="Check again"
    />
  );
}
