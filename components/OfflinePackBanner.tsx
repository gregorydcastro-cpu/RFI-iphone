"use client";

import { offlineBannerText, type OfflinePackSnapshot } from "@/lib/offlinePackCache";

type Props = {
  snapshot: OfflinePackSnapshot;
};

/**
 * Phone strip when the pack viewer is serving the device cache.
 * Tan status, one line — the red sheet card is a PDF failure, not this.
 */
export function OfflinePackBanner({ snapshot }: Props) {
  return (
    <div
      role="status"
      className="border-b border-tan/80 bg-ink px-3 py-3 sm:px-4"
    >
      <p className="text-base font-semibold leading-snug text-paper">
        {offlineBannerText(snapshot)}
      </p>
    </div>
  );
}
