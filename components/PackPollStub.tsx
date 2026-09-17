"use client";

import { useEffect, useState } from "react";
import type { RoomPack } from "@/lib/pack";
import {
  drivePackJsonPath,
  packStatusSessionKey,
  type PackStatusSnapshot,
} from "@/lib/packStatus";

const POLL_MS = 3_000;
const MAX_POLLS = 40;

type Props = {
  requestId: string;
  projectSlug: string;
  jobName: string;
  requestedRoom?: string;
  onPack: (pack: RoomPack) => void;
};

type LiveSnapshot = Pick<
  PackStatusSnapshot,
  "state" | "source" | "drivePath" | "unconfigured" | "error"
>;

/**
 * Background poll for Drive / public JSON status. Does not block the pack
 * viewer; Maple Point demo stays until status is ready.
 */
export function PackPollStub({
  requestId,
  projectSlug,
  jobName,
  requestedRoom,
  onPack,
}: Props) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot>({
    state: "pending",
    source: "stub",
    drivePath: drivePackJsonPath(projectSlug, requestId),
    unconfigured: true,
  });
  const [ticks, setTicks] = useState(0);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    async function tick() {
      attempts += 1;
      const statusUrl =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem(packStatusSessionKey(requestId))
          : null;

      try {
        const response = await fetch("/api/room-pack/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectSlug,
            requestId,
            statusUrl: statusUrl || undefined,
          }),
        });
        const data = (await response.json()) as PackStatusSnapshot & {
          ok?: boolean;
        };
        if (cancelled) return;
        if (!response.ok || data.ok === false) {
          setSnapshot({
            state: "error",
            source: "stub",
            drivePath: drivePackJsonPath(projectSlug, requestId),
            unconfigured: false,
            error: "Could not check pack status",
          });
          setStopped(true);
          return;
        }
        setSnapshot({
          state: data.state,
          source: data.source,
          drivePath: data.drivePath,
          unconfigured: data.unconfigured,
          error: data.error,
        });
        setTicks(attempts);
        if (data.state === "ready" && data.pack) {
          onPack(data.pack);
          setStopped(true);
          return;
        }
        if (data.state === "error" || !data.poll) {
          setStopped(true);
          return;
        }
      } catch {
        if (cancelled) return;
      }

      if (cancelled) return;
      if (attempts >= MAX_POLLS) {
        setStopped(true);
        return;
      }
      timer = window.setTimeout(tick, POLL_MS);
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [onPack, projectSlug, requestId]);

  const roomLabel = requestedRoom ? ` · room ${requestedRoom}` : "";
  const checks =
    ticks > 0 ? ` · checked ${ticks}×` : "";

  if (snapshot.state === "ready") {
    return (
      <p className="mt-0.5 text-xs text-tan">
        Pack ready for {jobName}
        {roomLabel}.
      </p>
    );
  }

  if (snapshot.state === "error") {
    return (
      <p className="mt-0.5 text-xs text-cta" role="status">
        {snapshot.error ?? "Pack status error"} for {jobName}
        {roomLabel}. Maple Point demo stays on screen.
      </p>
    );
  }

  if (stopped) {
    return (
      <p className="mt-0.5 text-xs text-tan">
        Still preparing {jobName}
        {roomLabel}. Refresh this page to check{" "}
        <span className="font-mono">{snapshot.drivePath}</span> again. Maple
        Point demo stays until the pack is ready.
      </p>
    );
  }

  return (
    <p className="mt-0.5 text-xs text-tan">
      Request accepted for {jobName}
      {roomLabel}. Waiting on{" "}
      <span className="font-mono">{snapshot.drivePath}</span>
      {checks}
      {snapshot.unconfigured
        ? " (Drive API not in env — polling the status interface until a public JSON URL is configured)."
        : "."}{" "}
      This page does not block. Maple Point demo stays until status is ready.
    </p>
  );
}
