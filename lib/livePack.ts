import type { DemoJob } from "./jobs";
import {
  stampRoomPack,
  type RoomPack,
} from "./pack";
import { loadPack } from "./loadPack";
import { packMatchesJob } from "./packStatus";
import { requestProcoreBotRefresh } from "./procoreBot";
import { pullProcoreRoomPack } from "./procoreRest";
import {
  fetchLatestRoomPackRow,
  getSupabaseConfig,
  insertRoomPackRow,
  roomPackFromRow,
} from "./supabaseRoomPack";

export type LivePackSource = "procore" | "supabase" | "local" | "none";
export type LivePackPull = "procore" | "bot" | "none";

export type LivePackLoad = {
  pack: RoomPack;
  source: LivePackSource;
  pull: LivePackPull;
  demoFallback: boolean;
  supabaseConfigured: boolean;
  requestId: string;
  restReason?: string;
};

async function maplePointFallback(
  requestId: string,
): Promise<RoomPack | null> {
  const named = await loadPack(requestId);
  if (named) return stampRoomPack(named);
  const demo = await loadPack("maple-point");
  return demo ? stampRoomPack(demo) : null;
}

/**
 * Website live view: read the latest `public.room_packs` row with no store
 * cache. Local Maple Point JSON only when Supabase is unset or has no
 * matching row. Never uses the deleted Procore webhook.
 */
export async function loadLiveRoomPack(input: {
  requestId: string;
  job?: DemoJob;
  room?: string;
}): Promise<LivePackLoad | null> {
  const supabaseConfigured = Boolean(getSupabaseConfig());

  if (supabaseConfigured) {
    const row = await fetchLatestRoomPackRow({
      requestId: input.requestId,
      projectName: input.job?.name,
      projectSlug: input.job?.slug,
      room: input.room,
    });
    const fromRow = row ? roomPackFromRow(row) : null;
    if (fromRow) {
      if (
        input.job &&
        !packMatchesJob(fromRow, input.job, input.requestId) &&
        !packMatchesJob(fromRow, input.job, input.job.slug)
      ) {
        console.error("[gcfieldlog] room_packs row rejected — job mismatch", {
          request_id: input.requestId,
        });
      } else {
        return {
          pack: fromRow,
          source: "supabase",
          pull: "none",
          demoFallback: false,
          supabaseConfigured,
          requestId: input.requestId,
        };
      }
    }
    const isMapleDemo =
      input.requestId === "maple-point" ||
      input.requestId.startsWith("maple-point-");
    if (!isMapleDemo) {
      return null;
    }
  }

  const fallback = await maplePointFallback(input.requestId);
  if (!fallback) return null;
  return {
    pack: fallback,
    source: "local",
    pull: "none",
    demoFallback: true,
    supabaseConfigured,
    requestId: input.requestId,
  };
}

/**
 * Puller refresh: try Procore REST with the session's stored tokens.
 * Bot + cached `room_packs` is the fallback when tokens are missing,
 * refresh fails, or sandbox/production cannot see the demo project.
 */
export async function refreshLiveRoomPack(input: {
  requestId: string;
  job: DemoJob;
  room: string;
  pack?: RoomPack;
  userId?: string | null;
}): Promise<LivePackLoad | null> {
  const cached = await loadLiveRoomPack({
    requestId: input.requestId,
    job: input.job,
    room: input.room,
  });
  let restReason: string | undefined;

  if (input.userId) {
    const rest = await pullProcoreRoomPack({
      userId: input.userId,
      job: input.job,
      room: input.room,
      requestId: input.requestId,
      cached: cached?.pack ?? null,
    });
    if (rest.ok) {
      if (getSupabaseConfig()) {
        await insertRoomPackRow({
          projectName: input.job.name,
          requestId: input.requestId,
          room: input.room,
          pack: rest.pack,
        });
      }
      return {
        pack: rest.pack,
        source: "procore",
        pull: "procore",
        demoFallback: false,
        supabaseConfigured: Boolean(getSupabaseConfig()),
        requestId: input.requestId,
        restReason: rest.reason,
      };
    }
    restReason = rest.reason;
    console.info("[gcfieldlog] procore rest pull fell back to bot", {
      request_id: input.requestId,
      reason: rest.reason,
    });
  }

  await requestProcoreBotRefresh({
    projectName: input.job.name,
    room: input.room,
    requestId: input.requestId,
  });

  if (input.pack && getSupabaseConfig()) {
    await insertRoomPackRow({
      projectName: input.job.name,
      requestId: input.requestId,
      room: input.room,
      pack: input.pack,
    });
  }

  const live = await loadLiveRoomPack({
    requestId: input.requestId,
    job: input.job,
    room: input.room,
  });
  if (!live) {
    return cached
      ? { ...cached, pull: "bot", restReason }
      : null;
  }
  return {
    ...live,
    pull: "bot",
    restReason,
  };
}
