"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getVoiceStatusServerSnapshot,
  getVoiceStatusSnapshot,
  loadVoiceStatus,
  subscribeVoiceStatus,
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

  if (!status || status.configured) return null;

  return (
    <p className={`text-xs text-tan ${className}`} role="status">
      Voice is off until the server voice key is set. Mic and read-aloud still
      show for field layout.
    </p>
  );
}
