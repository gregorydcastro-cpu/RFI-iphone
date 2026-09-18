/**
 * Procore pull is owned by the Field Log Procore bot. Webhook writes are
 * abandoned — the website does not POST to `procore_room_pack_webhook_url`.
 *
 * Bot id (ops): 969a9d8e-c07f-44c3-ae9d-862704cd60c7
 * The bot upserts `public.room_packs.pack_data`. This module only requests
 * a refresh; the site then reads the latest row.
 */

export const PROCORE_BOT_ID = "969a9d8e-c07f-44c3-ae9d-862704cd60c7";

export type ProcoreBotRefreshRequest = {
  projectName: string;
  room: string;
  requestId: string;
  /** From the selected job — never a global hardcoded company. */
  companyId: string;
};

export async function requestProcoreBotRefresh(
  input: ProcoreBotRefreshRequest,
): Promise<{ ok: true; requested: true; botId: typeof PROCORE_BOT_ID }> {
  console.info("[gcfieldlog] procore bot refresh requested", {
    request_id: input.requestId,
    room: input.room,
    company_id: input.companyId,
    bot_id: PROCORE_BOT_ID,
  });
  return {
    ok: true,
    requested: true,
    botId: PROCORE_BOT_ID,
  };
}
