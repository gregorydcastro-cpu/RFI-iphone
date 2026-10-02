/**
 * Browser pack-pull result. Soft-fails with a notice instead of dropping
 * the pack. One retry for a fast drop, a 5xx, or an empty/partial body.
 * A timeout or a reconnect does not start another wait. No tokens.
 */

import {
  PACK_LOAD_ATTEMPTS,
  PACK_LOAD_BACKOFF_MS,
  classifyPackHttp,
  type PackHttpClass,
} from "./packLoadField.ts";
import {
  PACK_REFRESH_CLIENT_MS,
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
  /** Nothing to show. Not a failed load. */
  empty: boolean;
  httpStatus: number;
};

type RefreshOnce = PackRefreshClientResult & { autoRetry: boolean };

function toPublic(result: RefreshOnce): PackRefreshClientResult {
  return {
    pack: result.pack,
    source: result.source,
    pull: result.pull,
    restReason: result.restReason,
    notice: result.notice,
    viewOnly: result.viewOnly,
    offline: result.offline,
    empty: result.empty,
    httpStatus: result.httpStatus,
  };
}

function fromClass(classified: PackHttpClass): RefreshOnce {
  return {
    pack: classified.pack,
    source: classified.source,
    pull: classified.pull,
    restReason: classified.restReason,
    notice: classified.notice,
    viewOnly: classified.viewOnly,
    offline: classified.offline,
    empty: classified.empty,
    httpStatus: classified.httpStatus,
    autoRetry: classified.autoRetry,
  };
}

async function readBody(response: Response): Promise<{
  body: unknown;
  unreadable: boolean;
}> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    return { body: null, unreadable: true };
  }
  if (text.trim().length === 0) return { body: null, unreadable: true };
  try {
    return { body: JSON.parse(text) as unknown, unreadable: false };
  } catch {
    return { body: null, unreadable: true };
  }
}

async function refreshOnce(input: {
  projectSlug?: string;
  requestId: string;
  room?: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  attempt: number;
}): Promise<RefreshOnce> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, input.timeoutMs);
  try {
    const response = await input.fetchImpl("/api/room-pack/refresh", {
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
    const { body, unreadable } = await readBody(response);
    return fromClass(
      classifyPackHttp({
        httpStatus: response.status,
        ok: response.ok,
        body,
        unreadable,
        attempt: input.attempt,
      }),
    );
  } catch {
    return fromClass(
      classifyPackHttp({
        httpStatus: 0,
        ok: false,
        body: null,
        timedOut,
        network: !timedOut,
        attempt: input.attempt,
      }),
    );
  } finally {
    clearTimeout(timer);
  }
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function requestPackRefresh(input: {
  projectSlug?: string;
  requestId: string;
  room?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  attempts?: number;
  backoffMs?: number;
}): Promise<PackRefreshClientResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? PACK_REFRESH_CLIENT_MS;
  const attempts = input.attempts ?? PACK_LOAD_ATTEMPTS;
  const backoffMs = input.backoffMs ?? PACK_LOAD_BACKOFF_MS;
  let last: RefreshOnce | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await refreshOnce({
      projectSlug: input.projectSlug,
      requestId: input.requestId,
      room: input.room,
      fetchImpl,
      timeoutMs,
      attempt,
    });
    last = result;
    if (!result.autoRetry || attempt >= attempts - 1) return toPublic(result);
    await wait(backoffMs);
  }
  return toPublic(
    last ?? {
      notice: null,
      viewOnly: false,
      offline: true,
      empty: false,
      httpStatus: 0,
      autoRetry: false,
    },
  );
}
