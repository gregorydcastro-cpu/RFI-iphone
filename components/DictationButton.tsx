"use client";

import { useEffect, useRef, useState } from "react";
import { loadVoiceStatus } from "@/lib/voiceStatus";

type Props = {
  onTranscript: (text: string) => void | Promise<void>;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
};

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function MicIcon({ recording }: { recording: boolean }) {
  if (recording) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-current">
        <rect x="6" y="6" width="12" height="12" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-6 fill-none stroke-current stroke-2">
      <rect x="9" y="3.5" width="6" height="11" rx="3" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 17v3.5" />
    </svg>
  );
}

/**
 * Composer mic for Grok batch STT. Tap to record, tap to stop and fill text.
 * Microphone icon is reserved for dictation (not voice-mode waveform).
 */
export function DictationButton({
  onTranscript,
  disabled = false,
  label = "Dictate",
  hint,
  className = "",
}: Props) {
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    void loadVoiceStatus();
    return () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }

  async function transcribe(blob: Blob, mimeType: string) {
    setPending(true);
    try {
      const body = new FormData();
      const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
      body.append("file", blob, `dictation.${ext}`);
      const response = await fetch("/api/dictation", { method: "POST", body });
      const data = (await response.json()) as {
        ok?: boolean;
        text?: string;
        error?: string;
        configured?: boolean;
      };
      if (!response.ok || !data.ok || !data.text) {
        setError(
          data.error ??
            (response.status === 503
              ? "Voice is not configured on the server."
              : "Could not transcribe. Try again."),
        );
        return;
      }
      setHeard(data.text);
      await onTranscript(data.text);
    } catch {
      setError("Could not reach dictation. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function startRecording() {
    setError(null);
    setHeard(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not available in this browser.");
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        releaseStream();
        if (blob.size < 1) {
          setError("No audio captured. Tap mic and speak.");
          setRecording(false);
          return;
        }
        void transcribe(blob, mimeType);
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
    } catch {
      releaseStream();
      setError("Microphone permission is required for dictation.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      releaseStream();
      setRecording(false);
    }
  }

  async function onClick() {
    if (disabled || pending) return;
    if (recording) {
      stopRecording();
      return;
    }
    await startRecording();
  }

  const status = pending
    ? "Transcribing…"
    : recording
      ? "Listening… tap to stop"
      : label;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={disabled || pending}
        aria-pressed={recording}
        aria-label={status}
        className={`inline-flex min-h-12 min-w-12 items-center justify-center gap-2 border px-4 text-sm font-semibold tracking-wide uppercase ${
          recording
            ? "border-cta bg-cta text-secondary"
            : "border-cta/70 bg-ink text-secondary hover:border-cta hover:bg-panel-2"
        } disabled:opacity-60`}
      >
        <MicIcon recording={recording} />
        <span>{status}</span>
      </button>
      {hint && !heard && !error && !recording && !pending ? (
        <p className="mt-2 text-xs text-muted">{hint}</p>
      ) : null}
      <p role="status" className="sr-only">
        {status}
      </p>
      {heard ? (
        <p className="mt-2 text-sm text-paper">
          Heard: <span className="text-muted">{heard}</span>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-cta">
          {error}
        </p>
      ) : null}
    </div>
  );
}
