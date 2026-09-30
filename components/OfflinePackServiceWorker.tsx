"use client";

import { useEffect } from "react";
import { registerOfflinePackWorker } from "@/lib/offlinePackWorker";

/**
 * Minimal registration only. The worker is network-first for pack PDFs and
 * never intercepts `/api/room-pack/*` live re-pulls. Updates claim the page
 * in place — do not reload; a crew may be mid-markup.
 */
export function OfflinePackServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    let cancelled = false;
    void registerOfflinePackWorker(navigator.serviceWorker).catch(() => {
      if (cancelled) return;
      // Private mode / insecure origin — IndexedDB cache still works.
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
