import type { DemoJob } from "./jobs";
import { loadPack } from "./loadPack";
import { stampRoomPack, type RoomPack } from "./pack";
import { packMatchesJob } from "./packStatus";
import { requestProcoreBotRefresh } from "./procoreBot";
import {
  fetchLatestRoomPackRow,
  getSupabaseConfig,
} from "./supabaseRoomPack";

export type LivePackSource = "supabase" | "local";

export type LivePackLoad = {
  pack: RoomPack;
  source: LivePackSource;
  demoFallback: boolean;
  liveConfigured: boolean;
  requestId: string;
};

async function maplePointFallback(requestId: string): Promise<RoomPack | null> {
  const named = await loadPack(requestId);
  if (named) return stampRoomPack(named);
  const demo = await loadPack("maple-point");
  return demo ? stampRoomPack(demo) : null;
}

function jobPackOk(
  pack: RoomPack,
  job: DemoJob | undefined,
  requestId: string,
): boolean {
  if (!job) return true;
  return (
    packMatchesJob(pack, job, requestId) ||
    packMatchesJob(pack, job, job.slug)
  );
}

function withJobCompany(pack: RoomPack, job?: DemoJob): RoomPack {
  if (!job || pack.company_id) return pack;
  return { ...pack, company_id: job.companyId };
}

/**
 * Latest `public.room_packs` row (pack_data jsonb). Local Maple Point JSON
 * only when Supabase is unset or has no matching row.
 */
export async function loadLiveRoomPack(input: {
  requestId: string;
  job?: DemoJob;
  room?: string;
}): Promise<LivePackLoad | null> {
  const liveConfigured = Boolean(getSupabaseConfig());

  if (liveConfigured) {
    const fromSb = await fetchLatestRoomPackRow({
      requestId: input.requestId,
      projectName: input.job?.name,
      projectSlug: input.job?.slug,
      room: input.room,
    });
    if (fromSb && jobPackOk(fromSb, input.job, input.requestId)) {
      return {
        pack: withJobCompany(fromSb, input.job),
        source: "supabase",
        demoFallback: false,
        liveConfigured,
        requestId: input.requestId,
      };
    }
  }

  const fallback = await maplePointFallback(input.requestId);
  if (!fallback) return null;
  return {
    pack: fallback,
    source: "local",
    demoFallback: true,
    liveConfigured,
    requestId: input.requestId,
  };
}

/**
 * Coordinate a Procore bot refresh, then read the latest room_packs row.
 * Webhook writes are not used. Maple Point demo when Supabase is unset.
 */
export async function refreshLiveRoomPack(input: {
  requestId: string;
  job: DemoJob;
  room: string;
}): Promise<LivePackLoad | null> {
  if (getSupabaseConfig()) {
    await requestProcoreBotRefresh({
      projectName: input.job.name,
      room: input.room,
      requestId: input.requestId,
      companyId: input.job.companyId,
    });
  }

  return loadLiveRoomPack({
    requestId: input.requestId,
    job: input.job,
    room: input.room,
  });
}
