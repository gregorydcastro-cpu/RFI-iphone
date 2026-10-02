/**
 * Live Procore REST pull for connected pullers.
 *
 * GET-only: companies, projects, current drawing revisions, RFIs.
 * Never POST RFIs, POs, or drawing uploads. Drafts stay in this app
 * (foreman only). Exact Procore project name, or optional
 * PROCORE_PROJECT_ALLOWLIST. DEMO_JOBS is not the REST gate.
 *
 * On missing tokens, a rejected refresh, empty sandbox companies, or API
 * errors, callers fall back to the cached room pack. A rejected refresh
 * is token_refresh_failed (reconnect). A timeout or 5xx is
 * procore_unreachable (retry). Neither is reported as a missing job.
 * The whole pull stops at PACK_REST_BUDGET_MS so a down Procore
 * cannot walk companies until the function times out.
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
import {
  isResolvableProjectName,
  pickResolvedProject,
  readProcoreId,
  type ResolvedProcoreProject,
} from "./procoreProjectMatch";
import { readProjectAllowlist } from "./procoreAllowlist";
import {
  procoreApiRequest,
} from "./procoreOAuth";
import {
  markProcoreReconnectNeeded,
} from "./procoreConnections";
import {
  resolveProcoreAccess,
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

/** Cap for one room-pack REST walk, including token refresh. */
export const PACK_REST_BUDGET_MS = 20_000;

export type ProcoreRestPullReason =
  | "ok"
  | "missing_oauth"
  | "missing_tokens"
  | "token_refresh_failed"
  | "project_not_found"
  | "api_error"
  | "procore_unreachable";

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

type AuthedKind = "ok" | "reconnect" | "unreachable" | "error";

type AuthedGet = {
  access: ValidProcoreAccess;
  body: unknown;
  ok: boolean;
  kind: AuthedKind;
};

function remainingMs(deadline: number): number {
  return deadline - Date.now();
}

async function authedGet(
  access: ValidProcoreAccess,
  path: string,
  extraHeaders: Record<string, string> | undefined,
  deadline: number,
): Promise<AuthedGet> {
  if (remainingMs(deadline) < 500) {
    return { access, body: null, ok: false, kind: "unreachable" };
  }
  let current = access;
  let result = await procoreApiRequest(
    current.config,
    current.accessToken,
    path,
    extraHeaders,
    remainingMs(deadline),
  );
  if (result.status === 401) {
    if (remainingMs(deadline) < 500) {
      return { access: current, body: null, ok: false, kind: "unreachable" };
    }
    const refreshed = await refreshStoredProcoreAccess(current.config, current.secrets);
    if (!refreshed.ok) {
      return {
        access: current,
        body: null,
        ok: false,
        kind: refreshed.reason === "reconnect_needed" ? "reconnect" : "unreachable",
      };
    }
    current = refreshed.access;
    if (remainingMs(deadline) < 500) {
      return { access: current, body: null, ok: false, kind: "unreachable" };
    }
    result = await procoreApiRequest(
      current.config,
      current.accessToken,
      path,
      extraHeaders,
      remainingMs(deadline),
    );
    if (result.status === 401) {
      await markProcoreReconnectNeeded(current.secrets.userId);
      return { access: current, body: null, ok: false, kind: "reconnect" };
    }
  }
  if (result.ok) return { access: current, body: result.body, ok: true, kind: "ok" };
  if (result.status === 0 || result.status >= 500) {
    return { access: current, body: result.body, ok: false, kind: "unreachable" };
  }
  return { access: current, body: result.body, ok: false, kind: "error" };
}

function reasonFromKind(
  kind: AuthedKind,
): "token_refresh_failed" | "procore_unreachable" | "api_error" {
  if (kind === "reconnect") return "token_refresh_failed";
  if (kind === "unreachable") return "procore_unreachable";
  return "api_error";
}

async function listAll(
  access: ValidProcoreAccess,
  path: string,
  extraHeaders: Record<string, string> | undefined,
  deadline: number,
): Promise<{
  access: ValidProcoreAccess;
  items: unknown[];
  ok: boolean;
  reason: ProcoreRestPullReason;
}> {
  const items: unknown[] = [];
  let current = access;
  const joiner = path.includes("?") ? "&" : "?";
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (remainingMs(deadline) < 500) {
      if (page === 1) {
        return { access: current, items, ok: false, reason: "procore_unreachable" };
      }
      break;
    }
    const paged = `${path}${joiner}per_page=${PAGE_SIZE}&page=${page}`;
    const result = await authedGet(current, paged, extraHeaders, deadline);
    current = result.access;
    if (!result.ok) {
      if (page === 1) {
        return {
          access: current,
          items,
          ok: false,
          reason: reasonFromKind(result.kind),
        };
      }
      break;
    }
    const chunk = listFromBody(result.body);
    items.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  return { access: current, items, ok: true, reason: "ok" };
}

/**
 * Company + project lookup on the same authed client as the pack lists.
 * A 401 refreshes once. It is not treated as "project not found".
 */
async function resolveProjectAuthed(
  access: ValidProcoreAccess,
  projectName: string,
  deadline: number,
): Promise<
  | { ok: true; access: ValidProcoreAccess; project: ResolvedProcoreProject }
  | {
      ok: false;
      access: ValidProcoreAccess;
      reason: "token_refresh_failed" | "procore_unreachable" | "project_not_found" | "api_error";
    }
> {
  const allowlist = readProjectAllowlist();
  if (!isResolvableProjectName(projectName, allowlist)) {
    return { ok: false, access, reason: "project_not_found" };
  }

  const companiesResult = await authedGet(
    access,
    "/rest/v1.0/companies",
    undefined,
    deadline,
  );
  if (!companiesResult.ok) {
    return {
      ok: false,
      access: companiesResult.access,
      reason: reasonFromKind(companiesResult.kind),
    };
  }
  if (!Array.isArray(companiesResult.body)) {
    return { ok: false, access: companiesResult.access, reason: "project_not_found" };
  }

  let current = companiesResult.access;
  const projectsByCompany: Array<{ companyId: string; projects: unknown }> = [];
  for (const company of companiesResult.body) {
    const companyId = readProcoreId(company);
    if (!companyId) continue;
    if (remainingMs(deadline) < 500) {
      return { ok: false, access: current, reason: "procore_unreachable" };
    }
    const projectsResult = await authedGet(
      current,
      `/rest/v1.0/projects?company_id=${encodeURIComponent(companyId)}`,
      { "Procore-Company-Id": companyId },
      deadline,
    );
    current = projectsResult.access;
    if (!projectsResult.ok) {
      const reason = reasonFromKind(projectsResult.kind);
      if (reason === "token_refresh_failed" || reason === "procore_unreachable") {
        return { ok: false, access: current, reason };
      }
      continue;
    }
    projectsByCompany.push({ companyId, projects: projectsResult.body });
  }

  const project = pickResolvedProject(
    companiesResult.body,
    projectsByCompany,
    projectName,
    allowlist,
  );
  if (!project) return { ok: false, access: current, reason: "project_not_found" };
  return { ok: true, access: current, project };
}

export async function pullProcoreRoomPack(input: {
  userId: string;
  job: DemoJob;
  room: string;
  requestId: string;
  cached?: RoomPack | null;
}): Promise<ProcoreRestPull> {
  const deadline = Date.now() + PACK_REST_BUDGET_MS;
  const resolvedAccess = await resolveProcoreAccess(input.userId);
  if (!resolvedAccess.ok) {
    const reason = resolvedAccess.reason;
    return {
      ok: false,
      reason:
        reason === "missing_oauth"
          ? "missing_oauth"
          : reason === "missing_tokens"
            ? "missing_tokens"
            : reason === "reconnect_needed"
              ? "token_refresh_failed"
              : "procore_unreachable",
    };
  }

  const resolved = await resolveProjectAuthed(
    resolvedAccess.access,
    input.job.name,
    deadline,
  );
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason };
  }

  const headers = companyHeaders(resolved.project.companyId);
  const drawings = await listAll(
    resolved.access,
    `/rest/v1.0/projects/${encodeURIComponent(resolved.project.projectId)}/drawing_revisions?drawing_set_id=current_set`,
    headers,
    deadline,
  );
  if (!drawings.ok) {
    return {
      ok: false,
      reason: drawings.reason === "ok" ? "api_error" : drawings.reason,
    };
  }

  const rfis = await listAll(
    drawings.access,
    `/rest/v1.0/projects/${encodeURIComponent(resolved.project.projectId)}/rfis`,
    headers,
    deadline,
  );
  if (!rfis.ok) {
    return {
      ok: false,
      reason: rfis.reason === "ok" ? "api_error" : rfis.reason,
    };
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
    projectId: resolved.project.projectId,
    sheets,
    rfis: mappedRfis,
  });
  const pack = mergeCachedLayout(built, input.cached ?? null);

  console.info("[gcfieldlog] procore rest pull", {
    request_id: input.requestId,
    company_id: resolved.project.companyId,
    project_id: resolved.project.projectId,
    sheets: pack.sheets.length,
    rfis: pack.rfis.length,
    token_refreshed:
      resolvedAccess.access.refreshed || drawings.access.refreshed,
  });

  return {
    ok: true,
    reason: "ok",
    pack,
    companyId: resolved.project.companyId,
    projectId: resolved.project.projectId,
    refreshedToken:
      resolvedAccess.access.refreshed || drawings.access.refreshed,
  };
}
