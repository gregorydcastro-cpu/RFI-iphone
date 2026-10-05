"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { DictateEmptyState, DictateFieldBanner } from "@/components/DictateFieldBanner";
import { VoiceEmptyState } from "@/components/VoiceEmptyState";
import {
  bindDictateDrop,
  dictateDropFromStop,
  dictateFieldSurface,
  dictateNetworkFromVoice,
  DICTATE_ATTEMPTS,
  DICTATE_BACKOFF_MS,
  shouldAutoRetryDictate,
  type DictateDrop,
  type DictatePermission,
} from "@/lib/dictateField";
import {
  parseVoiceErrorBody,
  type VoiceErrorCode,
} from "@/lib/voiceErrors";
import {
  voiceEmptyKindFromMicError,
  voiceEmptyKindFromTranscript,
  voiceEmptyMessage,
  type VoiceEmptyKind,
} from "@/lib/voiceEmpty";
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

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

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

async function readMicPermission(): Promise<DictatePermission | null> {
  const permissions = navigator.permissions;
  if (!permissions?.query) return null;
  try {
    const status = await permissions.query({
      name: "microphone" as PermissionName,
    });
    return status;
  } catch {
    return null;
  }
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
 * A mic or network drop mid-take uses the same Retry + Hear this card as a sheet miss.
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
  const speakSalt = useId();
  const voice = useSyncExternalStore(
    subscribeVoiceStatus,
    getVoiceStatusSnapshot,
    getVoiceStatusServerSnapshot,
  );
  const [recording, setRecording] = useState(false);
  const [pending, setPending] = useState(false);
  const [errorCode, setErrorCode] = useState<VoiceErrorCode | null>(null);
  const [drop, setDrop] = useState<DictateDrop | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [emptyKind, setEmptyKind] = useState<VoiceEmptyKind>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastClipRef = useRef<{ blob: Blob; mimeType: string } | null>(null);
  const silenceStopRef = useRef<(() => void) | null>(null);
  const dropUnbindRef = useRef<(() => void) | null>(null);
  const stoppingRef = useRef(false);
  const userStopRef = useRef(false);
  const dropRef = useRef<DictateDrop | null>(null);
  const permissionStateRef = useRef<string | null>(null);
  const recorderErrorRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  function clearSilenceWatch() {
    silenceStopRef.current?.();
    silenceStopRef.current = null;
  }

  function clearDropWatch() {
    dropUnbindRef.current?.();
    dropUnbindRef.current = null;
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadVoiceStatus();
    return () => {
      mountedRef.current = false;
      clearSilenceWatch();
      clearDropWatch();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function releaseStream() {
    clearSilenceWatch();
    clearDropWatch();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }

  function showVoiceError(code: VoiceErrorCode) {
    if (code === "unconfigured") markVoiceUnconfigured();
    setDrop(null);
    dropRef.current = null;
    setErrorCode(code);
    setEmptyKind("idle");
    setHeard(null);
  }

  function showDrop(next: DictateDrop, clip?: { blob: Blob; mimeType: string } | null) {
    dropRef.current = next;
    setDrop(next);
    setErrorCode(null);
    setEmptyKind("idle");
    setHeard(null);
    setRecording(false);
    setPending(false);
    if (next === "network" && clip && clip.blob.size > 0) {
      lastClipRef.current = clip;
    } else if (next !== "network") {
      lastClipRef.current = null;
    }
  }

  async function transcribe(blob: Blob, mimeType: string) {
    if (!mountedRef.current) return;
    setPending(true);
    setDrop(null);
    dropRef.current = null;
    setErrorCode(null);
    setEmptyKind("idle");
    setHeard(null);
    lastClipRef.current = { blob, mimeType };
    try {
      for (let attempt = 0; attempt < DICTATE_ATTEMPTS; attempt++) {
        if (!mountedRef.current) return;
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        if (offline) {
          if (shouldAutoRetryDictate({ attempt, network: true })) {
            await wait(DICTATE_BACKOFF_MS);
            continue;
          }
          if (mountedRef.current) showDrop("network", { blob, mimeType });
          return;
        }

        let response: Response;
        try {
          const body = new FormData();
          const ext = mimeType.includes("mp4")
            ? "m4a"
            : mimeType.includes("ogg")
              ? "ogg"
              : "webm";
          body.append("file", blob, `dictation.${ext}`);
          response = await fetch("/api/dictation", { method: "POST", body });
        } catch {
          if (shouldAutoRetryDictate({ attempt, network: true })) {
            await wait(DICTATE_BACKOFF_MS);
            continue;
          }
          if (mountedRef.current) showDrop("network", { blob, mimeType });
          return;
        }

        const data = await response.json().catch(() => null);
        const parsed = parseVoiceErrorBody(data, response.status);
        const text =
          data && typeof data === "object" && "text" in data && typeof data.text === "string"
            ? data.text.trim()
            : "";
        const silent = voiceEmptyKindFromTranscript({
          httpOk: response.ok,
          text,
          code: parsed.code,
        });
        if (silent) {
          if (!mountedRef.current) return;
          setEmptyKind(silent);
          setHeard(null);
          setErrorCode(null);
          setDrop(null);
          dropRef.current = null;
          lastClipRef.current = null;
          return;
        }
        if (!response.ok) {
          const network = dictateNetworkFromVoice({
            code: parsed.code,
            httpStatus: response.status,
          });
          if (network && shouldAutoRetryDictate({ attempt, network: true })) {
            await wait(DICTATE_BACKOFF_MS);
            continue;
          }
          if (!mountedRef.current) return;
          if (network) showDrop("network", { blob, mimeType });
          else showVoiceError(parsed.code);
          return;
        }
        if (!mountedRef.current) return;
        setHeard(text);
        setEmptyKind("idle");
        setErrorCode(null);
        setDrop(null);
        dropRef.current = null;
        lastClipRef.current = null;
        try {
          await onTranscript(text);
        } catch {
          // The clip was heard. Callers show their own failure.
        }
        return;
      }
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }

  function failLiveTake(next: DictateDrop) {
    if (userStopRef.current) return;
    if (dropRef.current === "permission" || dropRef.current === "network") return;
    const first = dropRef.current == null;
    if (next === "permission" || dropRef.current == null) dropRef.current = next;
    if (!first) return;
    stoppingRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
        return;
      } catch {
        // The recorder had already stopped.
      }
    }
    const mimeType = recorder?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    releaseStream();
    if (!mountedRef.current) return;
    showDrop(next, { blob, mimeType });
  }

  async function startRecording() {
    setErrorCode(null);
    setDrop(null);
    dropRef.current = null;
    setHeard(null);
    setEmptyKind("idle");
    userStopRef.current = false;
    permissionStateRef.current = null;
    recorderErrorRef.current = null;
    if (voiceStatusBlocksMic(voice)) {
      showVoiceError("unconfigured");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setEmptyKind("missing");
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType || typeof MediaRecorder === "undefined") {
      setEmptyKind("missing");
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
        const tracks = streamRef.current?.getAudioTracks() ?? [];
        const trackEnded = tracks.some((track) => track.readyState === "ended");
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const ended = dictateDropFromStop({
          userStop: userStopRef.current,
          already: dropRef.current,
          permissionState: permissionStateRef.current,
          trackEnded,
          recorderErrorName: recorderErrorRef.current,
        });
        releaseStream();
        if (!mountedRef.current) return;
        if (ended) {
          showDrop(ended, { blob, mimeType });
          return;
        }
        if (blob.size < 1) {
          setEmptyKind("silent");
          setErrorCode(null);
          setDrop(null);
          dropRef.current = null;
          setRecording(false);
          return;
        }
        void transcribe(blob, mimeType);
        setRecording(false);
      };
      const permission = await readMicPermission();
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      permissionStateRef.current = permission?.state ?? null;
      if (permission?.state === "denied") {
        releaseStream();
        showDrop("permission");
        return;
      }
      dropUnbindRef.current = bindDictateDrop({
        tracks: stream.getAudioTracks(),
        recorder,
        permission,
        onPermissionState: (state) => {
          permissionStateRef.current = state;
        },
        onRecorderError: (name) => {
          recorderErrorRef.current = name;
        },
        onDrop: (next) => {
          failLiveTake(next);
        },
      });
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
    } catch (caught) {
      releaseStream();
      const kind = voiceEmptyKindFromMicError(caught);
      if (kind) {
        setEmptyKind(kind);
        setErrorCode(null);
        setDrop(null);
        dropRef.current = null;
        return;
      }
      showVoiceError("failed");
    }
  }

  function stopRecording() {
    if (stoppingRef.current) return;
    userStopRef.current = true;
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
      setErrorCode(null);
      setDrop(null);
      dropRef.current = null;
      await startRecording();
      return;
    }
    const clip = lastClipRef.current;
    const surfaceNow = dictateFieldSurface({
      drop,
      errorCode,
      emptyKind,
      heard,
    });
    if (
      clip &&
      surfaceNow.kind === "error" &&
      surfaceNow.retrySameAudio
    ) {
      await transcribe(clip.blob, clip.mimeType);
      return;
    }
    setErrorCode(null);
    setDrop(null);
    dropRef.current = null;
    await startRecording();
  }

  const blocked = voiceStatusBlocksMic(voice);
  const status = pending ? "Saving" : recording ? "Listening" : label;
  const surface = dictateFieldSurface({
    recording,
    pending,
    heard,
    emptyKind,
    drop,
    errorCode,
  });

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
      {surface.kind === "ready" && !blocked ? (
        <>
          <VoiceEmptyState className="mt-2" message={voiceEmptyMessage(emptyKind)} />
          {emptyKind === "idle" && hint ? (
            <p className="mt-1 text-base leading-snug text-muted">{hint}</p>
          ) : null}
        </>
      ) : null}
      {surface.kind === "listening" || surface.kind === "saving" ? (
        <p role="status" className="mt-2 text-base font-semibold text-paper">
          {surface.kind === "listening" ? "Listening" : "Saving"}
        </p>
      ) : null}
      {surface.kind === "heard" ? (
        <p className="mt-2 text-base text-paper">
          Heard: <span className="text-muted">{surface.text}</span>
        </p>
      ) : null}
      {surface.kind === "empty" ? (
        <div className="mt-3">
          <DictateEmptyState
            title={surface.title}
            message={surface.message}
            speak={surface.speak}
            speakId={`dictate-empty-${speakSalt}`}
          />
        </div>
      ) : null}
      {surface.kind === "error" ? (
        <div className="mt-3">
          <DictateFieldBanner
            title={surface.title}
            message={surface.message}
            speak={surface.speak}
            speakId={`dictate-drop-${speakSalt}`}
            onRetry={() => void onRetry()}
          />
        </div>
      ) : null}
    </div>
  );
}
