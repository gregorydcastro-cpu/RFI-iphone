"use client";

import { useEffect } from "react";

/**
 * Minimal registration only. The worker is network-first for pack PDFs and
 * never intercepts `/api/room-pack/*` live re-pulls.
 */
export function OfflinePackServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    void navigator.serviceWorker
      .register("/offline-pack-sw.js", { scope: "/" })
      .catch(() => {
        // Private mode / insecure origin — IndexedDB cache still works.
      });
  }, []);
  return null;
}
