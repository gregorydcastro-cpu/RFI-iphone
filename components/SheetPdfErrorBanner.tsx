type Props = {
  title: string;
  message: string;
  onRetry?: () => void;
};

/**
 * Gloves-sized sheet PDF failure. Large type and a 48px retry target.
 */
export function SheetPdfErrorBanner({ title, message, onRetry }: Props) {
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
          className="mt-4 inline-flex min-h-12 min-w-12 items-center justify-center border border-cta bg-cta px-5 text-base font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
