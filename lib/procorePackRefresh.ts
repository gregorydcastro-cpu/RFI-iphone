/**
 * Browser pack-pull result. Soft-fails with a notice instead of dropping
 * the pack. No tokens.
 */

import {
  PACK_REFRESH_CLIENT_MS,
  packPullNotice,
  type PackPullNotice,
} from "./procoreAuthHealth.ts";
import type { RoomPack } from "./pack.ts";

export { PACK_REFRESH_CLIENT_MS };

export type PackRefreshClientResult = {
  pack?: RoomPack;
  source?: string;
  pull?: string;
  restReason?: string;
  notice: PackPullNotice | null;
  viewOnly: boolean;
  offline: boolean;
  httpStatus: number;
};

type RefreshBody = {
  ok?: boolean;
  source?: string;
  pull?: string;
  restReason?: string;
  reconnectNeeded?: boolean;
  pack?: RoomPack;
};

export async function requestPackRefresh(input: {
  projectSlug?: string;
  requestId: string;
  room?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<PackRefreshClientResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? PACK_REFRESH_CLIENT_MS,
  );
  try {
    const response = await fetchImpl("/api/room-pack/refresh", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectSlug: input.projectSlug,
        requestId: input.requestId,
        room: input.room,
      }),
      signal: controller.signal,
    });
    let data: RefreshBody = {};
    try {
      data = (await response.json()) as RefreshBody;
    } catch {
      data = {};
    }
    if (response.status === 403) {
      return {
        viewOnly: true,
        offline: false,
        notice: null,
        httpStatus: 403,
      };
    }
    const hasPack = Boolean(response.ok && data.ok && data.pack);
    const notice = packPullNotice({
      restReason: data.restReason,
      pull: data.pull,
      reconnectNeeded: data.reconnectNeeded,
    });
    if (hasPack && data.pack) {
      return {
        pack: data.pack,
        source: data.source,
        pull: data.pull,
        restReason: data.restReason,
        notice,
        viewOnly: false,
        offline: false,
        httpStatus: response.status,
      };
    }
    return {
      restReason: data.restReason,
      notice: notice ?? packPullNotice({ timedOut: true }),
      viewOnly: false,
      offline: !response.ok,
      httpStatus: response.status,
    };
  } catch {
    return {
      notice: packPullNotice({ timedOut: true }),
      viewOnly: false,
      offline: true,
      httpStatus: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
