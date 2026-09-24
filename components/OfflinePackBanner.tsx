"use client";

import { offlineBannerText, type OfflinePackSnapshot } from "@/lib/offlinePackCache";

type Props = {
  snapshot: OfflinePackSnapshot;
};

/**
 * Gloves-readable strip when the pack viewer is serving the device cache
 * instead of a live Procore / room_packs re-pull.
 */
export function OfflinePackBanner({ snapshot }: Props) {
  return (
    <div
      role="status"
      className="border-b border-cta/70 bg-ink px-3 py-2.5 sm:px-4"
    >
      <p className="text-sm font-semibold tracking-wide text-cta uppercase">
        Offline
      </p>
      <p className="mt-0.5 text-sm text-paper">{offlineBannerText(snapshot)}</p>
      <p className="mt-1 text-xs text-tan">
        Live pulls need a connection. This is the last good snapshot from
        today on this device — not a second Procore path.
      </p>
    </div>
  );
}
