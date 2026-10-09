import { fieldLinkIsMissing } from "./fieldLinkMiss.ts";
import { previewInvite } from "./inviteStore.ts";
import { loadLiveRoomPack } from "./livePack.ts";
import { packPageFound } from "./packPageFound.ts";

/** Same miss rules as the invite and pack pages. */
export async function missingFieldLink(pathname: string): Promise<boolean> {
  return fieldLinkIsMissing(pathname, {
    inviteMissing: async (token) => {
      const preview = await previewInvite(token);
      return preview.status === "not_found";
    },
    packMissing: async (requestId) => {
      const live = await loadLiveRoomPack({ requestId });
      return !packPageFound({ requestId, live });
    },
  });
}
