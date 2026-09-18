import type { DemoJob } from "./jobs";
import { loadPack } from "./loadPack";
import {
  stampRoomPack,
  type RoomPack,
} from "./pack";
import { packMatchesJob } from "./packStatus";
import { requestProcoreBotRefresh } from "./procoreBot";
import {
  fetchLatestRoomPackRow,
  getSupabaseConfig,
  insertRoomPackRow,
  roomPackFromRow,
} from "./supabaseRoomPack";

export type LivePackSource = "supabase" | "local" | "none";

export type LivePackLoad = {
  pack: RoomPack;
  source: LivePackSource;
  demoFallback: boolean;
  supabaseConfigured: boolean;
  requestId: string;
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
    demoFallback: true,
    supabaseConfigured,
    requestId: input.requestId,
  };
}

/**
 * Puller-only refresh: ask the Procore bot to pull, optionally persist pack
 * JSON the bot/ops posted, then re-read the latest room_packs row.
 */
export async function refreshLiveRoomPack(input: {
  requestId: string;
  job: DemoJob;
  room: string;
  pack?: RoomPack;
}): Promise<LivePackLoad | null> {
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

  return loadLiveRoomPack({
    requestId: input.requestId,
    job: input.job,
    room: input.room,
  });
}
