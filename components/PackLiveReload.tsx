"use client";

import { useCallback, useEffect, useState } from "react";
import { useOfflinePackCache } from "@/components/useOfflinePackCache";
import {
  isOfflineFetchFailure,
  OFFLINE_STATUS_LINE,
  type OfflinePackSnapshot,
} from "@/lib/offlinePackCache";
import type { RoomPack } from "@/lib/pack";
import { formatPulledAt, sheetRevisionLabel } from "@/lib/pack";
import {
  PACK_EMPTY_BODY_TEXT,
  PACK_KEPT_TEXT,
  PACK_LOAD_ATTEMPTS,
  PACK_LOAD_BACKOFF_MS,
  PACK_NONE_MESSAGE,
  classifyPackHttp,
  packPayloadState,
  type PackHttpClass,
} from "@/lib/packLoadField";
import {
  PACK_REFRESH_CLIENT_MS,
  PACK_RECONNECT_STRIP,
  type PackPullNotice,
} from "@/lib/procoreAuthHealth";
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
  /** Sheets already on screen. An empty or partial pull must not wipe them. */
  hasSheets?: boolean;
  /** Page already knows Procore needs a reconnect. A blip must not clear that. */
  sessionReconnect?: boolean;
  retryToken?: number;
  onPack: (pack: RoomPack, meta?: PackLiveMeta) => void;
  onNotice?: (notice: PackPullNotice | null) => void;
  onBusy?: (busy: boolean) => void;
};

type LivePayload = {
  pull?: string;
  source?: string;
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
 * A dropped load shows Retry. An honest empty does not.
 * Viewers never trigger a pull. No expiry poll loop.
 */
export function PackLiveReload({
  requestId,
  projectSlug,
  requestedRoom,
  procoreLinked,
  supabaseConfigured,
  demoFallback,
  hasSheets = false,
  sessionReconnect = false,
  retryToken = 0,
  onPack,
  onNotice,
  onBusy,
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

  const publish = useCallback(
    (next: PackPullNotice | null, healthy = false) => {
      if (sessionReconnect && !healthy && next?.tone !== "reconnect") return;
      onNotice?.(next);
    },
    [onNotice, sessionReconnect],
  );

  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);

  useEffect(() => {
    let cancelled = false;

    function wait(ms: number) {
      if (ms <= 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
    }

    async function acceptLive(pack: RoomPack, meta: PackLiveMeta) {
      if (cancelled) return false;
      if (hasSheets && packPayloadState(pack) !== "ready") return false;
      onPack(pack, meta);
      if (pack.sheets.length > 0) await offline.remember(pack);
      return true;
    }

    async function serveOffline(notice: PackPullNotice | null) {
      const snapshot = await offline.readFallback(false);
      if (cancelled) return false;
      if (!snapshot) return false;
      onPack(snapshot.pack, {
        source: "offline",
        pull: "none",
        offline: true,
        snapshot,
      });
      if (notice?.tone === "reconnect") publish(notice);
      else publish(null);
      setMessage(
        notice?.tone === "reconnect" || sessionReconnect
          ? (notice?.strip ?? PACK_RECONNECT_STRIP)
          : OFFLINE_STATUS_LINE,
      );
      return true;
    }

    function holdNotice(notice: PackPullNotice | null) {
      publish(notice);
      if (notice && (!sessionReconnect || notice.tone === "reconnect")) {
        setMessage(notice.strip);
      }
    }

    async function readLive(attempt = 0): Promise<PackHttpClass> {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, PACK_REFRESH_CLIENT_MS);
      try {
        const params = new URLSearchParams({ requestId });
        if (projectSlug) params.set("job", projectSlug);
        if (requestedRoom) params.set("room", requestedRoom);
        const live = await fetch(`/api/room-pack/live?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          signal: controller.signal,
        });
        let text = "";
        try {
          text = await live.text();
        } catch {
          text = "";
        }
        let body: unknown = null;
        let unreadable = text.trim().length === 0;
        if (!unreadable) {
          try {
            body = JSON.parse(text) as unknown;
          } catch {
            body = null;
            unreadable = true;
          }
        }
        const classified = classifyPackHttp({
          httpStatus: live.status,
          ok: live.ok,
          body,
          unreadable,
          attempt,
        });
        if (!cancelled && classified.autoRetry && attempt < PACK_LOAD_ATTEMPTS - 1) {
          await wait(PACK_LOAD_BACKOFF_MS);
          if (cancelled) return classified;
          return readLive(attempt + 1);
        }
        return classified;
      } catch {
        if (cancelled) {
          return classifyPackHttp({
            httpStatus: 0,
            ok: false,
            body: null,
            network: true,
            attempt: PACK_LOAD_ATTEMPTS,
          });
        }
        const classified = classifyPackHttp({
          httpStatus: 0,
          ok: false,
          body: null,
          timedOut,
          network: !timedOut,
          attempt,
        });
        if (classified.autoRetry && attempt < PACK_LOAD_ATTEMPTS - 1) {
          await wait(PACK_LOAD_BACKOFF_MS);
          if (cancelled) return classified;
          return readLive(attempt + 1);
        }
        return classified;
      } finally {
        clearTimeout(timer);
      }
    }

    async function applyClassified(
      classified: PackHttpClass,
      pending: PackPullNotice | null,
    ): Promise<"shown" | "empty" | "failed"> {
      const notice =
        pending?.tone === "reconnect" ? pending : (classified.notice ?? pending);
        if (classified.viewOnly) {
          publish(null, true);
          setMessage("View only — pulls are disabled for this session.");
          return "shown";
        }
        if (classified.pack && packPayloadState(classified.pack) === "ready") {
          const accepted = await acceptLive(classified.pack, {
            source: classified.source,
            pull: classified.pull,
            offline: false,
            snapshot: null,
          });
          if (!accepted || cancelled) return "failed";
          const healthy = classified.pull === "procore" && !classified.notice;
          if (notice?.tone === "reconnect") publish(notice);
          else if (healthy) publish(null, true);
          else if (classified.notice) publish(classified.notice);
        setMessage(
          (notice?.tone === "reconnect" ? notice.strip : classified.notice?.strip) ??
            statusLine(
              {
                pull: classified.pull,
                source: classified.source,
                restReason: classified.restReason,
                pack: classified.pack,
              },
              requestedRoom,
            ),
        );
        return "shown";
      }
      if (classified.empty && !classified.notice) {
        if (hasSheets) {
          if (pending && pending.tone !== "hint") holdNotice(pending);
          else {
            holdNotice({
              tone: "hint",
              text: PACK_KEPT_TEXT,
              strip: PACK_KEPT_TEXT,
              reconnect: false,
              retry: false,
            });
          }
          return "empty";
        }
        if (classified.pack && packPayloadState(classified.pack) === "empty") {
          await acceptLive(classified.pack, {
            source: classified.source,
            pull: classified.pull,
            offline: false,
            snapshot: null,
          });
        }
        if (pending?.tone === "reconnect") publish(pending);
        setMessage(PACK_NONE_MESSAGE);
        return "empty";
      }
      if (
        classified.pack &&
        packPayloadState(classified.pack) === "empty" &&
        hasSheets
      ) {
        holdNotice({
          tone: "retry",
          text: PACK_EMPTY_BODY_TEXT,
          strip: "Saved pack · pull did not finish.",
          reconnect: false,
          retry: true,
        });
        return "failed";
      }
      holdNotice(notice);
      return "failed";
    }

    async function load() {
      setBusy(true);
      let pending: PackPullNotice | null = null;
      let fetchFailed = false;
      try {
        if (procoreLinked) {
          const refresh = await requestPackRefresh({
            projectSlug,
            requestId,
            room: requestedRoom,
          });
          if (cancelled) return;
          if (refresh.viewOnly) {
            publish(null, true);
            setMessage("View only — pulls are disabled for this session.");
            return;
          }
          const applied = await applyClassified(
            {
              pack: refresh.pack,
              source: refresh.source,
              pull: refresh.pull,
              restReason: refresh.restReason,
              notice: refresh.notice,
              viewOnly: false,
              offline: refresh.offline,
              empty: refresh.empty,
              httpStatus: refresh.httpStatus,
              autoRetry: false,
            },
            null,
          );
          if (cancelled) return;
          if (applied === "shown") return;
          pending = refresh.notice;
          fetchFailed = refresh.offline || refresh.notice?.tone === "retry";
        }

        const live = await readLive();
        if (cancelled) return;
        if (
          live.offline ||
          live.notice?.tone === "retry" ||
          isOfflineFetchFailure({
            ok: live.httpStatus >= 200 && live.httpStatus < 300 && !live.notice,
            status: live.httpStatus,
          })
        ) {
          fetchFailed = true;
        }
        const applied = await applyClassified(live, pending);
        if (cancelled) return;
        if (applied === "shown") return;
        if (fetchFailed && (await serveOffline(pending))) return;
        if (applied === "empty") return;
        if (!pending && !live.notice) {
          setMessage(hasSheets ? PACK_KEPT_TEXT : PACK_NONE_MESSAGE);
        }
      } catch {
        fetchFailed = true;
        if (cancelled) return;
        if (await serveOffline(pending)) return;
        holdNotice({
          tone: "retry",
          text: "Shaky signal. This pack stays on screen. Tap Retry.",
          strip: "Saved pack · pull did not finish.",
          reconnect: false,
          retry: true,
        });
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    hasSheets,
    offline,
    onPack,
    procoreLinked,
    publish,
    projectSlug,
    requestId,
    requestedRoom,
    retryToken,
    sessionReconnect,
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
                if (refresh.viewOnly) {
                  publish(null, true);
                  setMessage("View only — pulls are disabled for this session.");
                  return;
                }
                if (
                  refresh.pack &&
                  packPayloadState(refresh.pack) === "ready"
                ) {
                  onPack(refresh.pack, {
                    source: refresh.source,
                    pull: refresh.pull,
                    offline: false,
                    snapshot: null,
                  });
                  const healthy = refresh.pull === "procore" && !refresh.notice;
                  if (refresh.notice?.tone === "reconnect") publish(refresh.notice);
                  else if (healthy) publish(null, true);
                  else publish(refresh.notice);
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
                  return;
                }
                if (refresh.offline || refresh.notice?.tone === "retry") {
                  const snapshot = await offline.readFallback(false);
                  if (snapshot) {
                    onPack(snapshot.pack, {
                      source: "offline",
                      pull: "none",
                      offline: true,
                      snapshot,
                    });
                    if (refresh.notice?.tone === "reconnect") publish(refresh.notice);
                    else publish(null);
                    setMessage(
                      refresh.notice?.tone === "reconnect" || sessionReconnect
                        ? (refresh.notice?.strip ??
                          PACK_RECONNECT_STRIP)
                        : OFFLINE_STATUS_LINE,
                    );
                    return;
                  }
                }
                if (
                  refresh.pack &&
                  packPayloadState(refresh.pack) === "empty" &&
                  hasSheets
                ) {
                  publish({
                    tone: "retry",
                    text: PACK_EMPTY_BODY_TEXT,
                    strip: "Saved pack · pull did not finish.",
                    reconnect: false,
                    retry: true,
                  });
                  setMessage("Saved pack · pull did not finish.");
                  return;
                }
                if (refresh.empty && !refresh.notice) {
                  publish(
                    hasSheets
                      ? {
                          tone: "hint",
                          text: PACK_KEPT_TEXT,
                          strip: PACK_KEPT_TEXT,
                          reconnect: false,
                          retry: false,
                        }
                      : null,
                  );
                  setMessage(hasSheets ? PACK_KEPT_TEXT : PACK_NONE_MESSAGE);
                  return;
                }
                publish(refresh.notice);
                setMessage(
                  refresh.notice?.strip ??
                    (hasSheets ? PACK_KEPT_TEXT : PACK_NONE_MESSAGE),
                );
              } catch {
                const snapshot = await offline.readFallback(false);
                if (snapshot) {
                  onPack(snapshot.pack, {
                    source: "offline",
                    pull: "none",
                    offline: true,
                    snapshot,
                  });
                  publish(null);
                  setMessage(OFFLINE_STATUS_LINE);
                  return;
                }
                publish({
                  tone: "retry",
                  text: "Shaky signal. This pack stays on screen. Tap Retry.",
                  strip: "Saved pack · pull did not finish.",
                  reconnect: false,
                  retry: true,
                });
                setMessage("Saved pack · pull did not finish.");
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
