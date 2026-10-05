"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOfflinePackCache } from "@/components/useOfflinePackCache";
import {
  isOfflineFetchFailure,
  OFFLINE_STATUS_LINE,
  type OfflinePackSnapshot,
} from "@/lib/offlinePackCache";
import type { RoomPack } from "@/lib/pack";
import {
  PACK_EMPTY_BODY_TEXT,
  PACK_KEPT_TEXT,
  PACK_LIVE_LOADING,
  PACK_LOAD_ATTEMPTS,
  PACK_LOAD_BACKOFF_MS,
  PACK_NONE_MESSAGE,
  PACK_VIEW_ONLY_LINE,
  classifyPackHttp,
  packLiveFallbackLine,
  packLiveOpeningLine,
  packLiveStatusLine,
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
  /** Pack already rendered by the page. Used so the status line does not open on loading. */
  pack?: RoomPack;
  source?: string;
  pull?: string;
  /** Sheets already on screen. An empty or partial pull must not wipe them. */
  hasSheets?: boolean;
  /** Page already knows Procore needs a reconnect. A blip must not clear that. */
  sessionReconnect?: boolean;
  retryToken?: number;
  onPack: (pack: RoomPack, meta?: PackLiveMeta) => void;
  onNotice?: (notice: PackPullNotice | null) => void;
  onBusy?: (busy: boolean) => void;
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
  pack,
  source,
  pull,
  hasSheets = false,
  sessionReconnect = false,
  retryToken = 0,
  onPack,
  onNotice,
  onBusy,
}: Props) {
  const [message, setMessage] = useState<string>(() =>
    packLiveOpeningLine({
      supabaseConfigured,
      demoFallback,
      source,
      pull,
      pack,
      room: requestedRoom,
    }),
  );
  const lineRef = useRef(message);
  const revealLine = useCallback((line: string) => {
    lineRef.current = line;
    setMessage(line);
  }, []);
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

    function reveal(line: string) {
      if (cancelled) return;
      revealLine(line);
    }

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
      if (pack.sheets.length > 0) void offline.remember(pack);
      return true;
    }

    async function serveOffline(notice: PackPullNotice | null) {
      const snapshot = await within(offline.readFallback(false), OFFLINE_SIDE_MS, null);
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
      reveal(
        notice?.tone === "reconnect" || sessionReconnect
          ? (notice?.strip ?? PACK_RECONNECT_STRIP)
          : OFFLINE_STATUS_LINE,
      );
      return true;
    }

    function holdNotice(notice: PackPullNotice | null) {
      publish(notice);
      if (!notice) return;
      if (sessionReconnect && notice.tone !== "reconnect") {
        if (lineRef.current === PACK_LIVE_LOADING) {
          reveal(packLiveFallbackLine(hasSheets));
        }
        return;
      }
      reveal(notice.strip);
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
          reveal(PACK_VIEW_ONLY_LINE);
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
        reveal(
          (notice?.tone === "reconnect" ? notice.strip : classified.notice?.strip) ??
            packLiveStatusLine(
              {
                pull: classified.pull,
                source: classified.source,
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
        reveal(PACK_NONE_MESSAGE);
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
            reveal(PACK_VIEW_ONLY_LINE);
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
          reveal(packLiveFallbackLine(hasSheets));
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
        if (!cancelled && lineRef.current === PACK_LIVE_LOADING) {
          reveal(packLiveFallbackLine(hasSheets));
        }
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
    revealLine,
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
                  revealLine(PACK_VIEW_ONLY_LINE);
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
                  revealLine(
                    refresh.notice?.strip ??
                      packLiveStatusLine(
                        {
                          pull: refresh.pull,
                          source: refresh.source,
                          pack: refresh.pack,
                        },
                        requestedRoom,
                      ),
                  );
                  void offline.remember(refresh.pack);
                  return;
                }
                if (refresh.offline || refresh.notice?.tone === "retry") {
                  const snapshot = await within(
                    offline.readFallback(false),
                    OFFLINE_SIDE_MS,
                    null,
                  );
                  if (snapshot) {
                    onPack(snapshot.pack, {
                      source: "offline",
                      pull: "none",
                      offline: true,
                      snapshot,
                    });
                    if (refresh.notice?.tone === "reconnect") publish(refresh.notice);
                    else publish(null);
                    revealLine(
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
                  revealLine("Saved pack · pull did not finish.");
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
                  revealLine(packLiveFallbackLine(hasSheets));
                  return;
                }
                publish(refresh.notice);
                revealLine(
                  refresh.notice?.strip ?? packLiveFallbackLine(hasSheets),
                );
              } catch {
                const snapshot = await within(
                  offline.readFallback(false),
                  OFFLINE_SIDE_MS,
                  null,
                );
                if (snapshot) {
                  onPack(snapshot.pack, {
                    source: "offline",
                    pull: "none",
                    offline: true,
                    snapshot,
                  });
                  publish(null);
                  revealLine(OFFLINE_STATUS_LINE);
                  return;
                }
                publish({
                  tone: "retry",
                  text: "Shaky signal. This pack stays on screen. Tap Retry.",
                  strip: "Saved pack · pull did not finish.",
                  reconnect: false,
                  retry: true,
                });
                revealLine("Saved pack · pull did not finish.");
              } finally {
                if (lineRef.current === PACK_LIVE_LOADING) {
                  revealLine(packLiveFallbackLine(hasSheets));
                }
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

const OFFLINE_SIDE_MS = 5_000;

function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
