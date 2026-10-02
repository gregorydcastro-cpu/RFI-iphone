"use client";

import { ReadAloudButton } from "./ReadAloudButton";

type BannerProps = {
  title: string;
  message: string;
  speak: string;
  speakId?: string;
  alert?: boolean;
  onRetry?: () => void;
  retryDisabled?: boolean;
  reconnectHref?: string;
  reconnectLabel?: string;
  retryLabel?: string;
  hearLabel?: string;
};

/**
 * Gloves-sized pack failure. Same calm card as a sheet PDF miss:
 * short title, short message, 48px Retry, Hear this.
 */
export function PackFieldBanner({
  title,
  message,
  speak,
  speakId = "pack-load-status",
  alert = false,
  onRetry,
  retryDisabled = false,
  reconnectHref,
  reconnectLabel = "Reconnect",
  retryLabel = "Retry",
  hearLabel = "Hear this",
}: BannerProps) {
  return (
    <div
      role={alert ? "alert" : "status"}
      className={
        alert
          ? "w-full border border-cta/70 bg-ink px-4 py-4 shadow-lg"
          : "w-full border border-tan/70 bg-ink px-4 py-4"
      }
    >
      <p
        className={
          alert
            ? "text-lg font-semibold text-cta"
            : "text-lg font-semibold text-paper"
        }
      >
        {title}
      </p>
      <p className="mt-2 text-base leading-snug text-paper">{message}</p>
      {reconnectHref ? (
        <a
          href={reconnectHref}
          className="mt-4 flex min-h-12 w-full items-center justify-center bg-cta px-5 text-base font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
        >
          {reconnectLabel}
        </a>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          disabled={retryDisabled}
          className={
            alert && !reconnectHref
              ? "mt-4 flex min-h-12 w-full items-center justify-center border border-cta bg-cta px-5 text-base font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
              : "mt-3 flex min-h-12 w-full items-center justify-center border border-line px-5 text-base font-semibold tracking-wide text-paper uppercase hover:border-cta disabled:opacity-60"
          }
        >
          {retryLabel}
        </button>
      ) : null}
      <ReadAloudButton
        id={speakId}
        text={speak}
        label={hearLabel}
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
 * No pack, or a pack with nothing to draw. Status, not the failed-load alert.
 */
export function PackEmptyState({
  title,
  message,
  speak,
  speakId = "pack-empty",
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
