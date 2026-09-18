import type { DemoJob } from "./jobs";
import { loadPack } from "./loadPack";
import { stampRoomPack, type RoomPack } from "./pack";
import { packMatchesJob } from "./packStatus";
import {
  buildRoomPackWebhookPayload,
  getProcoreRoomPackWebhookConfig,
  postRoomPackWebhook,
} from "./procoreRoomPack";
import { fetchPackStatus } from "./fetchPackStatus";
import {
  fetchLatestRoomPackRow,
  getSupabaseConfig,
} from "./supabaseRoomPack";

export type LivePackSource = "webhook" | "supabase" | "http" | "local";

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

/**
 * Latest pack for a live website view. Local JSON is not source of truth
 * when the webhook or Supabase path is configured.
 */
export async function loadLiveRoomPack(input: {
  requestId: string;
  job?: DemoJob;
  room?: string;
  statusUrl?: string;
  webhookPack?: RoomPack;
}): Promise<LivePackLoad | null> {
  const liveConfigured = Boolean(getProcoreRoomPackWebhookConfig());
  const supabaseConfigured = Boolean(getSupabaseConfig());

  if (input.webhookPack && jobPackOk(input.webhookPack, input.job, input.requestId)) {
    return {
      pack: stampRoomPack(input.webhookPack, { touch: true }),
      source: "webhook",
      demoFallback: false,
      liveConfigured,
      requestId: input.requestId,
    };
  }

  if (supabaseConfigured) {
    const fromSb = await fetchLatestRoomPackRow({
      requestId: input.requestId,
      projectName: input.job?.name,
      projectSlug: input.job?.slug,
      room: input.room,
    });
    if (fromSb && jobPackOk(fromSb, input.job, input.requestId)) {
      return {
        pack: fromSb,
        source: "supabase",
        demoFallback: false,
        liveConfigured,
        requestId: input.requestId,
      };
    }
  }

  if (input.job && (liveConfigured || supabaseConfigured)) {
    const snapshot = await fetchPackStatus({
      job: input.job,
      requestId: input.requestId,
      statusUrl: input.statusUrl,
      poll: liveConfigured,
      skipLocal: true,
    });
    if (snapshot.pack && jobPackOk(snapshot.pack, input.job, input.requestId)) {
      return {
        pack: stampRoomPack(snapshot.pack),
        source: snapshot.source === "http" ? "http" : "local",
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
 * Fresh Procore webhook pull, then read the latest pack (Supabase / status).
 * Maple Point demo when webhook env is unset.
 */
export async function refreshLiveRoomPack(input: {
  requestId: string;
  job: DemoJob;
  room: string;
  statusUrl?: string;
}): Promise<LivePackLoad | null> {
  const config = getProcoreRoomPackWebhookConfig();
  let webhookPack: RoomPack | undefined;
  let statusUrl = input.statusUrl;

  if (config) {
    const result = await postRoomPackWebhook(
      config,
      buildRoomPackWebhookPayload({
        projectName: input.job.name,
        room: input.room,
        requestId: input.requestId,
        companyId: input.job.companyId,
      }),
    );
    if (result.ok) {
      webhookPack = result.pack;
      statusUrl = result.statusUrl ?? statusUrl;
    }
  }

  return loadLiveRoomPack({
    requestId: input.requestId,
    job: input.job,
    room: input.room,
    statusUrl,
    webhookPack,
  });
}
