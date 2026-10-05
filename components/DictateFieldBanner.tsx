"use client";

import { ReadAloudButton } from "./ReadAloudButton";

type ErrorProps = {
  title: string;
  message: string;
  speak: string;
  speakId?: string;
  onRetry?: () => void;
};

/**
 * Mid-dictate failure. Same calm card as a sheet PDF miss:
 * short title, short message, 48px Retry, Hear this.
 */
export function DictateFieldBanner({
  title,
  message,
  speak,
  speakId = "dictate-drop",
  onRetry,
}: ErrorProps) {
  return (
    <div
      role="alert"
      className="w-full max-w-md border border-cta/70 bg-ink px-4 py-4 shadow-lg"
    >
      <p className="text-lg font-semibold text-cta">{title}</p>
      <p className="mt-2 text-base leading-snug text-paper">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 flex min-h-12 w-full items-center justify-center border border-cta bg-cta px-5 text-base font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
        >
          Retry
        </button>
      ) : null}
      <ReadAloudButton
        id={speakId}
        text={speak}
        label="Hear this"
        className="mt-3"
      />
    </div>
  );
}

type EmptyProps = {
  title: string;
  message: string;
  speak: string;
  speakId?: string;
};

/**
 * Nothing heard, or the mic was never available. Status, not the failed-take alert.
 */
export function DictateEmptyState({
  title,
  message,
  speak,
  speakId = "dictate-empty",
}: EmptyProps) {
  return (
    <div
      role="status"
      className="w-full max-w-md border border-line bg-ink px-4 py-4 shadow-lg"
    >
      <p className="text-lg font-semibold text-paper">{title}</p>
      <p className="mt-2 text-base leading-snug text-tan">{message}</p>
      <ReadAloudButton
        id={speakId}
        text={speak}
        label="Hear this"
        className="mt-3"
      />
    </div>
  );
}
