"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { VoiceFeedback } from "@/components/VoiceFeedback";
import {
  canRetrySameAudio,
  parseVoiceErrorBody,
  voiceErrorMessage,
  type VoiceErrorCode,
} from "@/lib/voiceErrors";
import {
  getVoiceStatusServerSnapshot,
  getVoiceStatusSnapshot,
  loadVoiceStatus,
  markVoiceUnconfigured,
  refreshVoiceStatus,
  subscribeVoiceStatus,
  voiceStatusBlocksMic,
} from "@/lib/voiceStatus";

type Props = {
  onTranscript: (text: string) => void | Promise<void>;
  /** Called when the mic opens, before speech. */
  onStart?: () => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  /**
   * RFI dictate: stop after a pause so gloves don't have to tap again.
   * Tap still stops early.
   */
  handsFree?: boolean;
};

const SPEECH_RMS = 0.02;
const SILENCE_MS = 2800;
const ARM_AFTER_MS = 500;
const SPEECH_HOLD_MS = 400;
const MAX_RECORD_MS = 90_000;
const SILENCE_TICK_MS = 200;

function watchDictationSilence(stream: MediaStream, onSilence: () => void): () => void {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return () => {};
  let audio: AudioContext;
  try {
    audio = new AudioCtx();
  } catch {
    return () => {};
  }
  const source = audio.createMediaStreamSource(stream);
  const analyser = audio.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  let heardSpeech = false;
  let speechMs = 0;
  let silenceAt = 0;
  const started = performance.now();
  void audio.resume().catch(() => {});
  const timer = window.setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      const sample = (samples[i] - 128) / 128;
      sum += sample * sample;
    }
    const rms = Math.sqrt(sum / samples.length);
    const now = performance.now();
    if (now - started >= ARM_AFTER_MS) {
      if (rms >= SPEECH_RMS) {
        speechMs += SILENCE_TICK_MS;
        silenceAt = 0;
        if (speechMs >= SPEECH_HOLD_MS) heardSpeech = true;
      } else if (heardSpeech) {
        if (!silenceAt) silenceAt = now;
        if (now - silenceAt >= SILENCE_MS) {
          onSilence();
          return;
        }
      }
    }
    if (now - started >= MAX_RECORD_MS) onSilence();
  }, SILENCE_TICK_MS);
  return () => {
    window.clearInterval(timer);
    source.disconnect();
    void audio.close().catch(() => {});
  };
}

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
  onStart,
  disabled = false,
  label = "Dictate",
  hint,
  className = "",
  handsFree = false,
}: Props) {
  const voice = useSyncExternalStore(
    subscribeVoiceStatus,
    getVoiceStatusSnapshot,
    getVoiceStatusServerSnapshot,
  );
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<VoiceErrorCode | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastClipRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  const silenceStopRef = useRef<(() => void) | null>(null);
  const stoppingRef = useRef(false);
  const mountedRef = useRef(true);

  function clearSilenceWatch() {
    silenceStopRef.current?.();
    silenceStopRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadVoiceStatus();
    return () => {
      mountedRef.current = false;
      clearSilenceWatch();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function releaseStream() {
    clearSilenceWatch();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }

  function showError(code: VoiceErrorCode, message?: string) {
    if (code === "unconfigured") markVoiceUnconfigured();
    setErrorCode(code);
    setError(voiceErrorMessage(code, message));
  }

  async function transcribe(blob: Blob, mimeType: string) {
    if (!mountedRef.current) return;
    setPending(true);
    lastClipRef.current = { blob, mimeType };
    try {
      const body = new FormData();
      const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
      body.append("file", blob, `dictation.${ext}`);
      const response = await fetch("/api/dictation", { method: "POST", body });
      const data = await response.json().catch(() => null);
      const parsed = parseVoiceErrorBody(data, response.status);
      const text =
        data && typeof data === "object" && "text" in data && typeof data.text === "string"
          ? data.text.trim()
          : "";
      if (!response.ok || !text) {
        showError(parsed.code, parsed.message);
        return;
      }
      setHeard(text);
      setError(null);
      setErrorCode(null);
      lastClipRef.current = null;
      await onTranscript(text);
    } catch {
      if (mountedRef.current) showError("unreachable");
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }

  async function startRecording() {
    setError(null);
    setErrorCode(null);
    setHeard(null);
    if (voiceStatusBlocksMic(voice)) {
      showError("unconfigured");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      showError("failed", "Microphone is not available in this browser.");
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType || typeof MediaRecorder === "undefined") {
      showError("failed", "Recording is not supported in this browser.");
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
          showError("no_speech");
          setRecording(false);
          return;
        }
        void transcribe(blob, mimeType);
        setRecording(false);
      };
      recorderRef.current = recorder;
      stoppingRef.current = false;
      recorder.start(250);
      if (handsFree) {
        silenceStopRef.current = watchDictationSilence(stream, () => {
          stopRecording();
        });
      }
      setRecording(true);
      onStart?.();
    } catch {
      releaseStream();
      showError("failed", "Microphone permission is required for dictation.");
    }
  }

  function stopRecording() {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearSilenceWatch();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.requestData();
      } catch {
        // requestData throws if the recorder already stopped.
      }
      recorder.stop();
      return;
    }
    releaseStream();
    setRecording(false);
  }

  async function onClick() {
    if (disabled || pending) return;
    if (recording) {
      stopRecording();
      return;
    }
    await startRecording();
  }

  async function onRetry() {
    if (errorCode === "unconfigured") {
      const next = await refreshVoiceStatus();
      if (voiceStatusBlocksMic(next)) return;
      setError(null);
      setErrorCode(null);
      await startRecording();
      return;
    }
    const clip = lastClipRef.current;
    if (clip && canRetrySameAudio(errorCode ?? undefined)) {
      setError(null);
      setErrorCode(null);
      await transcribe(clip.blob, clip.mimeType);
      return;
    }
    await startRecording();
  }

  const blocked = voiceStatusBlocksMic(voice);
  const status = pending ? "Saving" : recording ? "Listening" : label;

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={disabled || pending || blocked}
        aria-pressed={recording}
        aria-label={status}
        className={`inline-flex min-h-14 min-w-14 items-center justify-center gap-2 border px-4 text-sm font-semibold tracking-wide uppercase ${
          recording
            ? "border-cta bg-cta text-secondary"
            : "border-cta/70 bg-ink text-secondary hover:border-cta hover:bg-panel-2"
        } disabled:opacity-60`}
      >
        <MicIcon recording={recording} />
        <span>{status}</span>
      </button>
      {hint && !heard && !error && !recording && !pending && !blocked ? (
        <p className="mt-2 text-sm text-muted">{hint}</p>
      ) : null}
      {recording || pending ? (
        <p role="status" className="mt-2 text-base font-semibold text-paper">
          {recording ? "Listening" : "Saving"}
        </p>
      ) : null}
      {heard ? (
        <p className="mt-2 text-base text-paper">
          Heard: <span className="text-muted">{heard}</span>
        </p>
      ) : null}
      {error ? (
        <VoiceFeedback
          className="mt-3"
          title={errorCode === "unconfigured" ? "Voice is off" : "Dictation failed"}
          message={error}
          onRetry={() => void onRetry()}
          retryLabel={
            canRetrySameAudio(errorCode ?? undefined) ? "Retry" : "Dictate again"
          }
        />
      ) : null}
    </div>
  );
}
