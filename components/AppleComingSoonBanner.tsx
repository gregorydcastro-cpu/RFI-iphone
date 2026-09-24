"use client";

import { usePathname } from "next/navigation";

/**
 * Site chrome announcing the native iPhone/iPad app.
 * Matches Field Log dark racing tokens so the site previews the SwiftUI look.
 * Hidden on dense pack/viewer routes so sheets stay full-height.
 */
export function AppleComingSoonBanner() {
  const pathname = usePathname();
  if (pathname.startsWith("/pack")) {
    return null;
  }

  return (
    <aside
      role="status"
      aria-label="Apple and iPad app coming soon"
      className="border-b border-line bg-primary"
    >
      <div className="h-0.5 w-full bg-cta" aria-hidden />
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-1 px-4 py-3 text-center sm:px-6">
        <p className="font-display text-base tracking-wide text-secondary sm:text-lg">
          GC Field Log — Apple and iPad app coming soon
        </p>
        <p className="max-w-2xl text-xs leading-snug text-muted sm:text-sm">
          Same dark jobsite look on phone and iPad: room packs, markup to RFI,
          voice dictate, and time — built for the floor, not the trailer.
        </p>
      </div>
    </aside>
  );
}
