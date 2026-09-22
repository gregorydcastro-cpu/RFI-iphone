"use client";

import { useEffect, useState } from "react";
import { useOfflinePackCache } from "@/components/useOfflinePackCache";
import {
  isOfflineFetchFailure,
  offlineBannerText,
  type OfflinePackSnapshot,
} from "@/lib/offlinePackCache";
import type { RoomPack } from "@/lib/pack";
import { formatPulledAt, sheetRevisionLabel } from "@/lib/pack";

export type PackLiveMeta = {
  source?: string;
  pull?: string;
  offline?: boolean;
  snapshot?: OfflinePackSnapshot | null;
};

type Props = {
  requestId: string;
  projectSlug?: string;
  requestedRoom?: string;
  procoreLinked: boolean;
  supabaseConfigured: boolean;
  demoFallback: boolean;
  onPack: (pack: RoomPack, meta?: PackLiveMeta) => void;
};

type LivePayload = {
  ok?: boolean;
  error?: string;
  source?: string;
  pull?: string;
  restReason?: string;
  demoFallback?: boolean;
  pulled_at?: string;
  revision_stamp?: { drawing: string; rev: string };
  pack?: RoomPack;
};

/**
 * On every website pack open: re-read latest room_packs (no-store).
 * Pullers POST a refresh that tries Procore REST first, then the bot.
 * Viewers never trigger a pull. No expiry poll loop.
 */
export function PackLiveReload({
  requestId,
  projectSlug,
  requestedRoom,
  procoreLinked,
  supabaseConfigured,
  demoFallback,
  onPack,
}: Props) {
  const [message, setMessage] = useState<string>(
    supabaseConfigured
      ? "Loading latest pack…"
      : "Demo pack (Maple Point). Supabase / Procore path is unset locally.",
  );
  const [busy, setBusy] = useState(false);
  const offline = useOfflinePackCache({
    requestId,
    projectId: projectSlug,
    roomId: requestedRoom,
  });

  useEffect(() => {
    let cancelled = false;

    function acceptLive(data: LivePayload) {
      if (!data.pack) return false;
      onPack(data.pack, {
        source: data.source,
        pull: data.pull,
        offline: false,
        snapshot: null,
      });
      setMessage(statusLine(data, requestedRoom));
      void offline.remember(data.pack);
      return true;
    }

    async function serveOffline() {
      const snapshot = await offline.readFallback(false);
      if (cancelled) return Boolean(snapshot);
      if (!snapshot) return false;
      onPack(snapshot.pack, {
        source: "offline",
        pull: "none",
        offline: true,
        snapshot,
      });
      setMessage(offlineBannerText(snapshot));
      return true;
    }

    async function load(triggerPull: boolean) {
      setBusy(true);
      let fetchFailed = false;
      try {
        if (triggerPull && procoreLinked) {
          const refresh = await fetch("/api/room-pack/refresh", {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              projectSlug,
              requestId,
              room: requestedRoom,
            }),
          });
          const data = (await refresh.json()) as LivePayload;
          if (cancelled) return;
          if (refresh.status === 403) {
            setMessage("View only — pulls are disabled for this session.");
            return;
          }
          if (refresh.ok && data.ok && acceptLive(data)) return;
          if (
            isOfflineFetchFailure({
              ok: refresh.ok,
              status: refresh.status,
            })
          ) {
            fetchFailed = true;
          }
        }

        const params = new URLSearchParams({ requestId });
        if (projectSlug) params.set("job", projectSlug);
        if (requestedRoom) params.set("room", requestedRoom);
        const live = await fetch(`/api/room-pack/live?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });
        const data = (await live.json()) as LivePayload;
        if (cancelled) return;
        if (live.ok && data.ok && acceptLive(data)) return;
        if (
          isOfflineFetchFailure({
            ok: live.ok,
            status: live.status,
          })
        ) {
          fetchFailed = true;
        }
        if (fetchFailed && (await serveOffline())) return;
        setMessage(
          data.error ??
            "Could not load a live pack. Maple Point demo stays on screen.",
        );
      } catch {
        fetchFailed = true;
        if (cancelled) return;
        if (await serveOffline()) return;
        setMessage(
          "Could not reach the pack service. Maple Point demo stays on screen.",
        );
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load(true);
    return () => {
      cancelled = true;
    };
  }, [offline, onPack, procoreLinked, projectSlug, requestId, requestedRoom]);

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tan">
      <p>{message}</p>
      {procoreLinked ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void (async () => {
              try {
                const refresh = await fetch("/api/room-pack/refresh", {
                  method: "POST",
                  cache: "no-store",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    projectSlug,
                    requestId,
                    room: requestedRoom,
                  }),
                });
                const data = (await refresh.json()) as LivePayload;
                if (refresh.ok && data.ok && data.pack) {
                  onPack(data.pack, {
                    source: data.source,
                    pull: data.pull,
                    offline: false,
                    snapshot: null,
                  });
                  setMessage(statusLine(data, requestedRoom));
                  void offline.remember(data.pack);
                } else if (refresh.status === 403) {
                  setMessage("View only — pulls are disabled for this session.");
                } else if (
                  isOfflineFetchFailure({
                    ok: refresh.ok,
                    status: refresh.status,
                  })
                ) {
                  const snapshot = await offline.readFallback(false);
                  if (snapshot) {
                    onPack(snapshot.pack, {
                      source: "offline",
                      pull: "none",
                      offline: true,
                      snapshot,
                    });
                    setMessage(offlineBannerText(snapshot));
                  }
                }
              } catch {
                const snapshot = await offline.readFallback(false);
                if (snapshot) {
                  onPack(snapshot.pack, {
                    source: "offline",
                    pull: "none",
                    offline: true,
                    snapshot,
                  });
                  setMessage(offlineBannerText(snapshot));
                } else {
                  setMessage(
                    "Could not reach the pack service. Maple Point demo stays on screen.",
                  );
                }
              } finally {
                setBusy(false);
              }
            })();
          }}
          className="border border-cta bg-cta px-2 py-0.5 text-[10px] font-semibold tracking-wide text-secondary uppercase hover:bg-cta-hover disabled:opacity-60"
        >
          {busy ? "Pulling…" : "Pull"}
        </button>
      ) : demoFallback ? (
        <span className="text-metal">View only</span>
      ) : (
        <span className="text-metal">View only · live pack</span>
      )}
    </div>
  );
}

function statusLine(data: LivePayload, room?: string): string {
  const stamp = data.revision_stamp
    ? sheetRevisionLabel({
        id: data.revision_stamp.drawing,
        rev: data.revision_stamp.rev,
      })
    : data.pack?.revision_stamp
      ? sheetRevisionLabel({
          id: data.pack.revision_stamp.drawing,
          rev: data.pack.revision_stamp.rev,
        })
      : null;
  const pulled = formatPulledAt(data.pulled_at ?? data.pack?.pulled_at);
  const roomLabel = room ? ` · room ${room}` : "";
  const suffix = `${roomLabel}${stamp ? ` · ${stamp}` : ""}${
    pulled ? ` · pulled ${pulled}` : ""
  }.`;
  if (data.pull === "procore" || data.source === "procore") {
    return `Live (Procore REST)${suffix}`;
  }
  if (data.demoFallback || data.source === "local") {
    return `Demo pack (Maple Point)${suffix}`;
  }
  if (data.pull === "bot") {
    return `Cached pack (bot fallback)${suffix}`;
  }
  return `Cached pack${suffix}`;
}
