/**
 * Server-only Procore Room pack webhook client.
 *
 * Vercel Production keys are lowercase. Read those exact names only —
 * do not look up PROCORE_ROOM_PACK_*. Never log the URL or Authorization value.
 */

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
};

export type ProcoreRoomPackWebhookConfig = {
  url: string;
  authorization: string;
};

export type RoomPackWebhookPostResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null; aborted: boolean };

function readLowercaseEnv(key: string): string | undefined {
  // Bracket access so Next.js does not inline at build time; Vercel injects
  // these at runtime on the server. Keys are lowercase only.
  const value = process.env[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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
}): RoomPackWebhookPayload {
  return {
    project: input.projectName,
    room: input.room,
    request_id: input.requestId,
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

    // Discard body; never log it (may include internals). Status only.
    await response.text().catch(() => undefined);

    if (response.ok) {
      return { ok: true, status: response.status };
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
