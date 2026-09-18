/**
 * Server-only Procore Room pack webhook client.
 *
 * Vercel Production keys are lowercase. Read those exact names only —
 * do not look up PROCORE_ROOM_PACK_*. Never log the URL or Authorization value.
 */

import { readLowercaseEnv } from "./env";
import { pickPackFromWebhookBody, pickStatusUrlFromWebhookBody } from "./packStatus";
import type { RoomPack } from "./pack";

export const PROCORE_ROOM_PACK_WEBHOOK_URL_KEY =
  "procore_room_pack_webhook_url" as const;
export const PROCORE_ROOM_PACK_WEBHOOK_AUTHORIZATION_KEY =
  "procore_room_pack_webhook_authorization" as const;

/** Fail the webhook POST if Procore does not accept within this window. */
const WEBHOOK_ACCEPT_TIMEOUT_MS = 12_000;

export type RoomPackWebhookPayload = {
  project: string;
  room: string;
  request_id: string;
  /** Dynamic per job — never a single hardcoded company. */
  company_id: string;
};

export type ProcoreRoomPackWebhookConfig = {
  url: string;
  authorization: string;
};

export type RoomPackWebhookPostResult =
  | { ok: true; status: number; statusUrl?: string; pack?: RoomPack }
  | { ok: false; status: number | null; aborted: boolean };

/**
 * Both keys must be non-empty. Local Maple Point demo leaves them unset.
 */
export function getProcoreRoomPackWebhookConfig():
  | ProcoreRoomPackWebhookConfig
  | null {
  const url = readLowercaseEnv(PROCORE_ROOM_PACK_WEBHOOK_URL_KEY);
  const authorization = readLowercaseEnv(
    PROCORE_ROOM_PACK_WEBHOOK_AUTHORIZATION_KEY,
  );
  if (!url || !authorization) return null;
  return { url, authorization };
}

/**
 * Procore accepted payload. `project` must be the selected job's exact name
 * (never a slug, never another job).
 */
export function buildRoomPackWebhookPayload(input: {
  projectName: string;
  room: string;
  requestId: string;
  companyId: string;
}): RoomPackWebhookPayload {
  return {
    project: input.projectName,
    room: input.room,
    request_id: input.requestId,
    company_id: input.companyId,
  };
}

export async function postRoomPackWebhook(
  config: ProcoreRoomPackWebhookConfig,
  payload: RoomPackWebhookPayload,
): Promise<RoomPackWebhookPostResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_ACCEPT_TIMEOUT_MS);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: config.authorization,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    // Parse for an optional status/json URL. Never log the body.
    const raw = await response.text().catch(() => "");
    let statusUrl: string | undefined;
    let pack: RoomPack | undefined;
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        statusUrl = pickStatusUrlFromWebhookBody(parsed);
        pack = pickPackFromWebhookBody(parsed) ?? undefined;
      } catch {
        statusUrl = undefined;
      }
    }

    if (response.ok) {
      return { ok: true, status: response.status, statusUrl, pack };
    }

    console.error("[gcfieldlog] room-pack webhook was not accepted", {
      status: response.status,
      request_id: payload.request_id,
    });
    return { ok: false, status: response.status, aborted: false };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] room-pack webhook request failed", {
      aborted,
      request_id: payload.request_id,
    });
    return { ok: false, status: null, aborted };
  } finally {
    clearTimeout(timer);
  }
}
