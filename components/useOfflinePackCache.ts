"use client";

import { useCallback, useMemo } from "react";
import {
  shouldUseOfflineFallback,
  type OfflinePackSnapshot,
} from "@/lib/offlinePackCache";
import {
  readOfflinePack,
  rememberOfflinePack,
} from "@/lib/offlinePackStore";
import type { RoomPack } from "@/lib/pack";

type Lookup = {
  requestId: string;
  projectId?: string;
  roomId?: string;
};

/**
 * Wiring hook: write a snapshot after a successful live pack load;
 * read the last good snapshot only when live fetch missed.
 */
export function useOfflinePackCache(lookup: Lookup) {
  const remember = useCallback(
    async (pack: RoomPack) => {
      try {
        await rememberOfflinePack({
          pack,
          requestId: lookup.requestId,
          projectId: lookup.projectId,
          roomId: lookup.roomId,
        });
      } catch {
        // Device storage is best-effort.
      }
    },
    [lookup.projectId, lookup.requestId, lookup.roomId],
  );

  const readFallback = useCallback(
    async (gotLivePack: boolean): Promise<OfflinePackSnapshot | null> => {
      if (!shouldUseOfflineFallback({ gotLivePack })) return null;
      try {
        return await readOfflinePack({
          requestId: lookup.requestId,
          projectId: lookup.projectId,
          roomId: lookup.roomId,
        });
      } catch {
        return null;
      }
    },
    [lookup.projectId, lookup.requestId, lookup.roomId],
  );

  return useMemo(
    () => ({ remember, readFallback }),
    [remember, readFallback],
  );
}
