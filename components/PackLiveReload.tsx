"use client";

import { useEffect, useState } from "react";
import type { RoomPack } from "@/lib/pack";
import { formatPulledAt, sheetRevisionLabel } from "@/lib/pack";

type Props = {
  requestId: string;
  projectSlug?: string;
  requestedRoom?: string;
  liveConfigured: boolean;
  demoFallback: boolean;
  onPack: (pack: RoomPack) => void;
};

type RefreshPayload = {
  ok?: boolean;
  error?: string;
  source?: string;
  demoFallback?: boolean;
  pulled_at?: string;
  revision_stamp?: { drawing: string; rev: string };
  pack?: RoomPack;
};

/**
 * On every website pack open: ask the Procore bot to refresh, then read the
 * latest room_packs.pack_data row. Maple Point demo when Supabase is unset.
 */
export function PackLiveReload({
  requestId,
  projectSlug,
  requestedRoom,
  liveConfigured,
  demoFallback,
  onPack,
}: Props) {
  const [message, setMessage] = useState(
    liveConfigured
      ? "Pulling latest pack…"
      : "Demo pack (Maple Point). Supabase is unset locally.",
  );

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const response = await fetch("/api/room-pack/refresh", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectSlug,
            requestId,
            room: requestedRoom,
          }),
        });
        const data = (await response.json()) as RefreshPayload;
        if (cancelled) return;
        if (response.ok && data.ok && data.pack) {
          onPack(data.pack);
          setMessage(statusLine(data, requestedRoom));
          return;
        }
        setMessage(
          data.error ??
            "Could not refresh the pack. Maple Point demo stays on screen.",
        );
      } catch {
        if (!cancelled) {
          setMessage(
            "Could not reach the pack service. Maple Point demo stays on screen.",
          );
        }
      }
    }

    void refresh();
    return () => {
      cancelled = true;
    };
  }, [onPack, projectSlug, requestId, requestedRoom]);

  return (
    <p className="mt-0.5 text-xs text-tan">
      {message}
      {demoFallback && liveConfigured ? " Waiting on the live pull." : ""}
    </p>
  );
}

function statusLine(data: RefreshPayload, room?: string): string {
  const stamp = data.revision_stamp
    ? sheetRevisionLabel({
        id: data.revision_stamp.drawing,
        rev: data.revision_stamp.rev,
      })
    : null;
  const pulled = formatPulledAt(data.pulled_at ?? data.pack?.pulled_at);
  const roomLabel = room ? ` · room ${room}` : "";
  if (data.demoFallback || data.source === "local") {
    return `Demo pack (Maple Point)${roomLabel}${stamp ? ` · ${stamp}` : ""}${
      pulled ? ` · pulled ${pulled}` : ""
    }.`;
  }
  return `Live pack${roomLabel}${stamp ? ` · ${stamp}` : ""}${
    pulled ? ` · pulled ${pulled}` : ""
  }.`;
}
