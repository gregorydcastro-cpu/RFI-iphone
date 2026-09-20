"use client";

type Props = {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

/**
 * Gloves-sized voice status / error. Large type + 48px retry target.
 */
export function VoiceFeedback({
  title,
  message,
  onRetry,
  retryLabel = "Retry",
  className = "",
}: Props) {
  return (
    <div
      role="alert"
      className={`border border-cta/60 bg-ink px-4 py-4 ${className}`}
    >
      <p className="text-base font-semibold text-cta">{title}</p>
      <p className="mt-2 text-base text-paper">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex min-h-12 min-w-12 items-center justify-center border border-cta bg-cta px-4 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
