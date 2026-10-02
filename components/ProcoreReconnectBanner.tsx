"use client";

import { ReadAloudButton } from "@/components/ReadAloudButton";
import type { PackPullNotice } from "@/lib/procoreAuthHealth";

type Props = {
  notice: PackPullNotice;
  reconnectHref?: string;
  onRetry?: () => void;
  busy?: boolean;
};

/**
 * Soft status under the pack header. The saved pack stays on screen.
 * Reconnect uses the same /api/procore/connect flow.
 */
export function ProcoreReconnectBanner({
  notice,
  reconnectHref,
  onRetry,
  busy = false,
}: Props) {
  return (
    <div className="border-b border-tan/60 bg-panel px-4 py-3" role="status">
      <p className="text-base text-paper">{notice.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {notice.reconnect && reconnectHref ? (
          <a
            href={reconnectHref}
            className="inline-flex min-h-11 items-center bg-cta px-4 py-2 text-sm font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover"
          >
            Reconnect
          </a>
        ) : null}
        {notice.retry && onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            disabled={busy}
            className="inline-flex min-h-11 items-center border border-line px-4 py-2 text-sm font-semibold tracking-wide text-paper uppercase hover:border-cta disabled:opacity-60"
          >
            Retry
          </button>
        ) : null}
        <ReadAloudButton
          id="pack-procore-status"
          text={notice.text}
          label="Hear this"
        />
      </div>
    </div>
  );
}
