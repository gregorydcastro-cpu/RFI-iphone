"use client";

import { usePathname } from "next/navigation";

/**
 * Site chrome banner for native app announce.
 * Hidden on dense pack/viewer routes so sheets stay full-height.
 */
export function AppleComingSoonBanner() {
  const pathname = usePathname();
  if (pathname.startsWith("/pack")) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-b border-cta/50 bg-panel-2 px-3 py-2 text-center"
    >
      <p className="font-display text-sm tracking-wide text-secondary sm:text-base">
        GC Field Log — Apple and iPad app coming soon
      </p>
    </div>
  );
}
