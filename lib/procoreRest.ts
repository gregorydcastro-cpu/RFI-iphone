/**
 * Live Procore REST pull for connected pullers.
 *
 * GET-only: companies, projects, current drawing revisions, RFIs.
 * Never POST RFIs, POs, or drawing uploads. Drafts stay in this app
 * (foreman only). Demo job names only — Maple Point / other DEMO_JOBS.
 *
 * On missing tokens, expired refresh, empty sandbox companies, or API
 * errors, callers fall back to the Procore bot + cached room_packs.
 */

import type { DemoJob } from "./jobs";
import {
  DEFAULT_ACTIONS,
  stampRoomPack,
  type RoomPack,
} from "./pack";
import {
  mapDrawingRevisionToSheet,
  mapProcoreRfi,
  mergeCachedLayout,
  restRoomPackFields,
} from "./procorePackMap";
import { resolveProjectForName } from "./procoreCompany";
import {
  getProcoreOAuthConfig,
  procoreApiRequest,
} from "./procoreOAuth";
import {
  getValidProcoreAccess,
  refreshStoredProcoreAccess,
  type ValidProcoreAccess,
} from "./procoreToken";

export {
  mapDrawingRevisionToSheet,
  mapProcoreRfi,
  mergeCachedLayout,
} from "./procorePackMap";

const PAGE_SIZE = 100;
const MAX_PAGES = 8;

export type ProcoreRestPullReason =
  | "ok"
  | "missing_oauth"
  | "missing_tokens"
  | "token_refresh_failed"
  | "project_not_found"
  | "api_error";

export type ProcoreRestPull =
  | {
      ok: true;
      reason: "ok";
      pack: RoomPack;
      companyId: string;
      projectId: string;
      refreshedToken: boolean;
    }
  | {
      ok: false;
      reason: Exclude<ProcoreRestPullReason, "ok">;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function listFromBody(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const rec = asRecord(body);
  if (rec && Array.isArray(rec.data)) return rec.data;
  return [];
}

export function companyHeaders(companyId: string): Record<string, string> {
  return { "Procore-Company-Id": companyId };
}

export function buildRestRoomPack(input: {
  job: DemoJob;
  room: string;
  requestId: string;
  projectId: string;
  sheets: RoomPack["sheets"];
  rfis: RoomPack["rfis"];
  pulledAt?: string;
}): RoomPack {
  return stampRoomPack(
    {
      ...restRoomPackFields(input),
      actions: DEFAULT_ACTIONS,
    },
    { pulledAt: input.pulledAt, touch: true },
  );
}

async function authedGet(
  access: ValidProcoreAccess,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<{ access: ValidProcoreAccess; body: unknown; ok: boolean }> {
  let current = access;
  let result = await procoreApiRequest(
    current.config,
    current.accessToken,
    path,
    extraHeaders,
  );
  if (result.status === 401) {
    const refreshed = await refreshStoredProcoreAccess(current.config, current.secrets);
    if (!refreshed) {
      return { access: current, body: null, ok: false };
    }
    current = refreshed;
    result = await procoreApiRequest(
      current.config,
      current.accessToken,
      path,
      extraHeaders,
    );
  }
  return { access: current, body: result.body, ok: result.ok };
}

async function listAll(
  access: ValidProcoreAccess,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<{ access: ValidProcoreAccess; items: unknown[]; ok: boolean }> {
  const items: unknown[] = [];
  let current = access;
  const joiner = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const paged = `${path}${joiner}per_page=${PAGE_SIZE}&page=${page}`;
    const result = await authedGet(current, paged, extraHeaders);
    current = result.access;
    if (!result.ok) return { access: current, items, ok: page === 1 ? false : true };
    const chunk = listFromBody(result.body);
    items.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return { access: current, items, ok: true };
}

export async function pullProcoreRoomPack(input: {
  userId: string;
  job: DemoJob;
  room: string;
  requestId: string;
  cached?: RoomPack | null;
}): Promise<ProcoreRestPull> {
  const access = await getValidProcoreAccess(input.userId);
  if (!access) {
    return {
      ok: false,
      reason: getProcoreOAuthConfig() ? "missing_tokens" : "missing_oauth",
    };
  }

  const resolved = await resolveProjectForName(
    access.config,
    access.accessToken,
    input.job.name,
  );
  if (!resolved) {
    return { ok: false, reason: "project_not_found" };
  }

  const headers = companyHeaders(resolved.companyId);
  const drawings = await listAll(
    access,
    `/rest/v1.0/projects/${encodeURIComponent(resolved.projectId)}/drawing_revisions?drawing_set_id=current_set`,
    headers,
  );
  if (!drawings.ok) {
    return { ok: false, reason: "api_error" };
  }

  const rfis = await listAll(
    drawings.access,
    `/rest/v1.0/projects/${encodeURIComponent(resolved.projectId)}/rfis`,
    headers,
  );
  if (!rfis.ok) {
    return { ok: false, reason: "api_error" };
  }

  const sheets = drawings.items
    .map(mapDrawingRevisionToSheet)
    .filter((sheet): sheet is NonNullable<typeof sheet> => Boolean(sheet));
  const mappedRfis = rfis.items
    .map(mapProcoreRfi)
    .filter((rfi): rfi is NonNullable<typeof rfi> => Boolean(rfi));

  const built = buildRestRoomPack({
    job: input.job,
    room: input.room,
    requestId: input.requestId,
    projectId: resolved.projectId,
    sheets,
    rfis: mappedRfis,
  });
  const pack = mergeCachedLayout(built, input.cached ?? null);

  console.info("[gcfieldlog] procore rest pull", {
    request_id: input.requestId,
    company_id: resolved.companyId,
    project_id: resolved.projectId,
    sheets: pack.sheets.length,
    rfis: pack.rfis.length,
    token_refreshed: access.refreshed || drawings.access.refreshed,
  });

  return {
    ok: true,
    reason: "ok",
    pack,
    companyId: resolved.companyId,
    projectId: resolved.projectId,
    refreshedToken: access.refreshed || drawings.access.refreshed,
  };
}
