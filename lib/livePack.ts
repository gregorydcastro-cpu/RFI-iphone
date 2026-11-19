import { isDemoOrFictionalJob, type DemoJob } from "./jobs.ts";
import {
  stampRoomPack,
  type RoomPack,
} from "./pack.ts";
import { loadPack } from "./loadPack.ts";
import { packMatchesJob } from "./packStatus.ts";
import {
  requestProcoreBotRefresh,
  skippedDemoProcoreBotRefresh,
  type ProcoreBotRefreshResult,
} from "./procoreBot.ts";
import {
  fetchLatestRoomPackRow,
  getSupabaseConfig,
  insertRoomPackRow,
  roomPackFromRow,
} from "./supabaseRoomPack.ts";

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
  bot?: ProcoreBotRefreshResult;
};

function isMaplePointRequest(requestId: string): boolean {
  return (
    requestId === "maple-point" || requestId.startsWith("maple-point-")
  );
}

/**
 * Named `public/packs/<id>.json` first (Maple Point, Cedar Ridge, and any
 * other checked-in fixture). A missing file may still use the Maple Point
 * sample for a fictional demo request id. Any other id misses.
 */
async function localDemoPack(requestId: string): Promise<RoomPack | null> {
  const named = await loadPack(requestId);
  if (named) return stampRoomPack(named);
  if (!isDemoOrFictionalJob({ requestId })) return null;
  const demo = await loadPack("maple-point");
  return demo ? stampRoomPack(demo) : null;
}

/**
 * Website live view: read the latest `public.room_packs` row with no store
 * cache. A named static fixture (Maple Point, Cedar Ridge) is used when
 * Supabase is unset, the read misses, or the database is unreachable.
 * Maple Point request ids without their own file still use that sample.
 * Never uses the deleted Procore webhook.
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
    const named = await loadPack(input.requestId);
    if (!named && !isMaplePointRequest(input.requestId)) {
      return null;
    }
  }

  const fallback = await localDemoPack(input.requestId);
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
 * refresh fails, or the exact project name cannot be resolved.
 * Bot fallback enqueues / HTTP-wakes the fleet — not log-only —
 * except fictional DEMO_JOBS / Maple Point, which never wake.
 */
export async function refreshLiveRoomPack(input: {
  requestId: string;
  job: DemoJob;
  room: string;
  pack?: RoomPack;
  userId?: string | null;
  /** Project was verified on this user's Procore list. */
  ignoreAllowlist?: boolean;
}): Promise<LivePackLoad | null> {
  const cached = await loadLiveRoomPack({
    requestId: input.requestId,
    job: input.job,
    room: input.room,
  });
  let restReason: string | undefined;

  if (input.userId) {
    const { pullProcoreRoomPack } = await import("./procoreRest.ts");
    const rest = await pullProcoreRoomPack({
      userId: input.userId,
      job: input.job,
      room: input.room,
      requestId: input.requestId,
      cached: cached?.pack ?? null,
      ignoreAllowlist: input.ignoreAllowlist,
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

  const skipDemoWake = isDemoOrFictionalJob({
    slug: input.job.slug,
    name: input.job.name,
    requestId: input.requestId,
  });
  const bot = skipDemoWake
    ? skippedDemoProcoreBotRefresh()
    : await requestProcoreBotRefresh({
        projectName: input.job.name,
        room: input.room,
        requestId: input.requestId,
        reason: restReason ?? "refresh",
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
  const pull: LivePackPull = skipDemoWake ? "none" : "bot";
  if (!live) {
    return cached
      ? { ...cached, pull, restReason, bot }
      : null;
  }
  return {
    ...live,
    pull,
    restReason,
    bot,
  };
}
