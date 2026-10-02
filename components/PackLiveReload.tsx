"use client";

import { useEffect, useState } from "react";
import { useOfflinePackCache } from "@/components/useOfflinePackCache";
import {
  isOfflineFetchFailure,
  OFFLINE_STATUS_LINE,
  type OfflinePackSnapshot,
} from "@/lib/offlinePackCache";
import type { RoomPack } from "@/lib/pack";
import { formatPulledAt, sheetRevisionLabel } from "@/lib/pack";
import type { PackPullNotice } from "@/lib/procoreAuthHealth";
import { requestPackRefresh } from "@/lib/procorePackRefresh";

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
  retryToken?: number;
  onPack: (pack: RoomPack, meta?: PackLiveMeta) => void;
  onNotice?: (notice: PackPullNotice | null) => void;
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
 * A dead Procore session keeps the pack and asks to reconnect.
 * Viewers never trigger a pull. No expiry poll loop.
 */
export function PackLiveReload({
  requestId,
  projectSlug,
  requestedRoom,
  procoreLinked,
  supabaseConfigured,
  demoFallback,
  retryToken = 0,
  onPack,
  onNotice,
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

    async function acceptLive(data: LivePayload) {
      if (!data.pack || cancelled) return false;
      onPack(data.pack, {
        source: data.source,
        pull: data.pull,
        offline: false,
        snapshot: null,
      });
      await offline.remember(data.pack);
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
      setMessage(OFFLINE_STATUS_LINE);
      return true;
    }

    async function load() {
      setBusy(true);
      let fetchFailed = false;
      try {
        if (procoreLinked) {
          const refresh = await requestPackRefresh({
            projectSlug,
            requestId,
            room: requestedRoom,
          });
          if (cancelled) return;
          onNotice?.(refresh.notice);
          if (refresh.viewOnly) {
            setMessage("View only — pulls are disabled for this session.");
          } else if (refresh.pack) {
            const accepted = await acceptLive({
              ok: true,
              pack: refresh.pack,
              source: refresh.source,
              pull: refresh.pull,
              restReason: refresh.restReason,
            });
            if (cancelled) return;
            if (accepted) {
              setMessage(
                refresh.notice?.strip ??
                  statusLine(
                    {
                      pull: refresh.pull,
                      source: refresh.source,
                      restReason: refresh.restReason,
                      pack: refresh.pack,
                    },
                    requestedRoom,
                  ),
              );
              return;
            }
          } else if (refresh.offline) {
            fetchFailed = true;
            if (refresh.notice) setMessage(refresh.notice.strip);
          } else if (refresh.notice) {
            setMessage(refresh.notice.strip);
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
        if (live.ok && data.ok && (await acceptLive(data))) {
          if (!fetchFailed) setMessage(statusLine(data, requestedRoom));
          return;
        }
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

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    offline,
    onNotice,
    onPack,
    procoreLinked,
    projectSlug,
    requestId,
    requestedRoom,
    retryToken,
  ]);

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
                const refresh = await requestPackRefresh({
                  projectSlug,
                  requestId,
                  room: requestedRoom,
                });
                onNotice?.(refresh.notice);
                if (refresh.viewOnly) {
                  setMessage("View only — pulls are disabled for this session.");
                } else if (refresh.pack) {
                  onPack(refresh.pack, {
                    source: refresh.source,
                    pull: refresh.pull,
                    offline: false,
                    snapshot: null,
                  });
                  setMessage(
                    refresh.notice?.strip ??
                      statusLine(
                        {
                          pull: refresh.pull,
                          source: refresh.source,
                          restReason: refresh.restReason,
                          pack: refresh.pack,
                        },
                        requestedRoom,
                      ),
                  );
                  await offline.remember(refresh.pack);
                } else if (refresh.offline) {
                  const snapshot = await offline.readFallback(false);
                  if (snapshot) {
                    onPack(snapshot.pack, {
                      source: "offline",
                      pull: "none",
                      offline: true,
                      snapshot,
                    });
                    setMessage(refresh.notice?.strip ?? OFFLINE_STATUS_LINE);
                  } else {
                    setMessage(
                      refresh.notice?.strip ??
                        "Pull didn't finish. Maple Point demo stays on screen. Retry.",
                    );
                  }
                } else {
                  setMessage(
                    refresh.notice?.strip ??
                      "Pull didn't finish. The saved pack stays on screen. Retry.",
                  );
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
                  setMessage(OFFLINE_STATUS_LINE);
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
