"use client";

import { PackFieldBanner } from "@/components/PackFieldBanner";
import {
  packFieldAlert,
  packFieldSpeak,
  packFieldTitle,
} from "@/lib/packLoadField";
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
 * A failed pull uses the same Retry + Hear this card as a sheet miss.
 */
export function ProcoreReconnectBanner({
  notice,
  reconnectHref,
  onRetry,
  busy = false,
}: Props) {
  const retry = notice.retry && onRetry ? onRetry : undefined;
  return (
    <div className="border-b border-line bg-ink px-4 py-3">
      <PackFieldBanner
        title={packFieldTitle(notice)}
        message={notice.text}
        speak={packFieldSpeak(notice)}
        speakId="pack-procore-status"
        alert={packFieldAlert(notice)}
        reconnectHref={notice.reconnect ? reconnectHref : undefined}
        reconnectLabel="Reconnect"
        onRetry={retry}
        retryDisabled={busy}
        retryLabel="Retry"
        hearLabel="Hear this"
      />
    </div>
  );
}
