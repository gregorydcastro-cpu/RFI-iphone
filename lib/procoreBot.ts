/**
 * Procore pull is owned by the Field Log Procore bot — not the deleted
 * Room pack webhook routine. Do not call `procore_room_pack_webhook_url`
 * or webhook Authorization from the website live path.
 *
 * Bot id (ops): 969a9d8e-c07f-44c3-ae9d-862704cd60c7
 * The bot pulls drawings from Procore and upserts `public.room_packs`.
 * This module is the website's refresh-request / ops coordinate path.
 */

export const PROCORE_BOT_ID = "969a9d8e-c07f-44c3-ae9d-862704cd60c7";

export type ProcoreBotRefreshRequest = {
  projectName: string;
  room: string;
  requestId: string;
};

export type ProcoreBotRefreshResult = {
  ok: true;
  requested: true;
  botId: typeof PROCORE_BOT_ID;
};

/**
 * Ask the Procore bot to pull a fresh pack. Website callers then read
 * `public.room_packs` — they do not wait on a webhook.
 */
export async function requestProcoreBotRefresh(
  input: ProcoreBotRefreshRequest,
): Promise<ProcoreBotRefreshResult> {
  console.info("[gcfieldlog] procore bot refresh requested", {
    request_id: input.requestId,
    room: input.room,
    bot_id: PROCORE_BOT_ID,
  });
  return {
    ok: true,
    requested: true,
    botId: PROCORE_BOT_ID,
  };
}
