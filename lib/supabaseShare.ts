/**
 * Service-role CRUD for share_folders, pinned_sheets, sheet_revision_cache.
 *
 * Stub session ids (`stub:` + sha256 email) are not auth.uid(), so writes
 * require SUPABASE_SERVICE_ROLE_KEY. Anon has no grants on these tables.
 * Never call Procore from here. Never NEXT_PUBLIC_ the service role key.
 */

import {
  getSupabaseServiceConfig,
  type SupabaseServiceConfig,
} from "./procoreConnections";
import {
  PINNED_SHEETS_TABLE,
  SHARE_FOLDERS_TABLE,
  SHEET_REVISION_CACHE_TABLE,
  type PinnedSheetRow,
  type ShareFolderRow,
  type SheetRevisionCacheRow,
} from "./schema";

const FETCH_TIMEOUT_MS = 8_000;

export function isShareTableWriteConfigured(): boolean {
  return getSupabaseServiceConfig() !== null;
}

export async function selectShareFolders(
  ownerUserId: string,
): Promise<ShareFolderRow[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams();
  params.set("owner_user_id", `eq.${ownerUserId}`);
  params.set("select", "id,owner_user_id,name,created_at");
  params.set("order", "created_at.desc");

  const response = await restFetch(
    config,
    `${SHARE_FOLDERS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json.flatMap((row) => {
    const parsed = asShareFolderRow(row);
    return parsed ? [parsed] : [];
  });
}

export async function insertShareFolder(input: {
  id?: string;
  ownerUserId: string;
  name: string;
}): Promise<ShareFolderRow | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const body: Record<string, unknown> = {
    owner_user_id: input.ownerUserId,
    name: input.name,
  };
  if (input.id) body.id = input.id;

  const response = await restFetch(config, SHARE_FOLDERS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!response) return null;
  if (!response.ok) {
    console.error("[gcfieldlog] share_folders insert was not ok", {
      status: response.status,
    });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  const row = Array.isArray(json) ? json[0] : json;
  return asShareFolderRow(row);
}

export async function deleteShareFolder(input: {
  id: string;
  ownerUserId: string;
}): Promise<boolean> {
  const config = getSupabaseServiceConfig();
  if (!config) return false;

  const params = new URLSearchParams();
  params.set("id", `eq.${input.id}`);
  params.set("owner_user_id", `eq.${input.ownerUserId}`);

  const response = await restFetch(
    config,
    `${SHARE_FOLDERS_TABLE}?${params.toString()}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  if (!response) return false;
  if (!response.ok) {
    console.error("[gcfieldlog] share_folders delete was not ok", {
      status: response.status,
    });
    return false;
  }
  return true;
}

const PINNED_SHEET_SELECT =
  "id,folder_id,project_name,sheet_id,discipline,last_seen_rev,last_pulled_at";
const REVISION_CACHE_SELECT = "id,project_name,sheet_id,rev,checked_at";
const SHARE_LIST_LIMIT = "2000";

export async function selectPinnedSheets(
  folderIds: string[],
): Promise<PinnedSheetRow[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  if (folderIds.length === 0) return [];

  const params = new URLSearchParams();
  params.set("folder_id", `in.(${folderIds.join(",")})`);
  params.set("select", PINNED_SHEET_SELECT);
  params.set("order", "sheet_id.asc");

  const response = await restFetch(
    config,
    `${PINNED_SHEETS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json.flatMap((row) => {
    const parsed = asPinnedSheetRow(row);
    return parsed ? [parsed] : [];
  });
}

/** Service-role scan of every share folder. Used by weekly notify owner lookup. */
export async function selectAllShareFolders(): Promise<ShareFolderRow[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams();
  params.set("select", "id,owner_user_id,name,created_at");
  params.set("order", "created_at.desc");
  params.set("limit", SHARE_LIST_LIMIT);

  const response = await restFetch(
    config,
    `${SHARE_FOLDERS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json.flatMap((row) => {
    const parsed = asShareFolderRow(row);
    return parsed ? [parsed] : [];
  });
}

/** Service-role scan of every pin. Used by the weekly cron, not Refresh all. */
export async function selectAllPinnedSheets(): Promise<PinnedSheetRow[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams();
  params.set("select", PINNED_SHEET_SELECT);
  params.set("order", "sheet_id.asc");
  params.set("limit", SHARE_LIST_LIMIT);

  const response = await restFetch(
    config,
    `${PINNED_SHEETS_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json.flatMap((row) => {
    const parsed = asPinnedSheetRow(row);
    return parsed ? [parsed] : [];
  });
}

export async function upsertPinnedSheets(
  rows: Array<{
    id?: string;
    folderId: string;
    projectName: string;
    sheetId: string;
    discipline: string | null;
    lastSeenRev: string;
    lastPulledAt?: string | null;
  }>,
): Promise<PinnedSheetRow[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  if (rows.length === 0) return [];

  const body = rows.map((row) => {
    const packet: Record<string, unknown> = {
      folder_id: row.folderId,
      project_name: row.projectName,
      sheet_id: row.sheetId,
      discipline: row.discipline,
      last_seen_rev: row.lastSeenRev,
      last_pulled_at: row.lastPulledAt ?? null,
    };
    if (row.id) packet.id = row.id;
    return packet;
  });

  const response = await restFetch(
    config,
    `${PINNED_SHEETS_TABLE}?on_conflict=folder_id,project_name,sheet_id`,
    {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    },
  );
  if (!response) return null;
  if (!response.ok) {
    console.error("[gcfieldlog] pinned_sheets upsert was not ok", {
      status: response.status,
    });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) {
    const parsed = asPinnedSheetRow(json);
    return parsed ? [parsed] : [];
  }
  return json.flatMap((row) => {
    const parsed = asPinnedSheetRow(row);
    return parsed ? [parsed] : [];
  });
}

export async function deletePinnedSheet(input: {
  id: string;
  folderIds: string[];
}): Promise<boolean> {
  const config = getSupabaseServiceConfig();
  if (!config) return false;
  if (input.folderIds.length === 0) return false;

  const params = new URLSearchParams();
  params.set("id", `eq.${input.id}`);
  params.set("folder_id", `in.(${input.folderIds.join(",")})`);

  const response = await restFetch(
    config,
    `${PINNED_SHEETS_TABLE}?${params.toString()}`,
    { method: "DELETE", headers: { Prefer: "return=minimal" } },
  );
  if (!response) return false;
  if (!response.ok) {
    console.error("[gcfieldlog] pinned_sheets delete was not ok", {
      status: response.status,
    });
    return false;
  }
  return true;
}

export async function updatePinnedSheetRev(input: {
  id: string;
  lastSeenRev: string;
  lastPulledAt: string;
}): Promise<boolean> {
  const config = getSupabaseServiceConfig();
  if (!config) return false;

  const params = new URLSearchParams();
  params.set("id", `eq.${input.id}`);

  const response = await restFetch(
    config,
    `${PINNED_SHEETS_TABLE}?${params.toString()}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        last_seen_rev: input.lastSeenRev,
        last_pulled_at: input.lastPulledAt,
      }),
    },
  );
  if (!response) return false;
  if (!response.ok) {
    console.error("[gcfieldlog] pinned_sheets rev patch was not ok", {
      status: response.status,
    });
    return false;
  }
  return true;
}

export async function selectRevisionCache(
  projectNames: string[],
): Promise<SheetRevisionCacheRow[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  if (projectNames.length === 0) return [];

  const rows: SheetRevisionCacheRow[] = [];
  for (const projectName of projectNames) {
    const params = new URLSearchParams();
    params.set("project_name", `eq.${projectName}`);
    params.set("select", REVISION_CACHE_SELECT);
    params.set("limit", "500");

    const response = await restFetch(
      config,
      `${SHEET_REVISION_CACHE_TABLE}?${params.toString()}`,
      { method: "GET" },
    );
    if (!response || !response.ok) return null;
    const json: unknown = await response.json().catch(() => null);
    if (!Array.isArray(json)) return null;
    for (const row of json) {
      const parsed = asRevisionCacheRow(row);
      if (parsed) rows.push(parsed);
    }
  }
  return rows;
}

/** Service-role scan of the full rev cache. Used by the weekly cron. */
export async function selectAllRevisionCache(): Promise<
  SheetRevisionCacheRow[] | null
> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;

  const params = new URLSearchParams();
  params.set("select", REVISION_CACHE_SELECT);
  params.set("order", "sheet_id.asc");
  params.set("limit", SHARE_LIST_LIMIT);

  const response = await restFetch(
    config,
    `${SHEET_REVISION_CACHE_TABLE}?${params.toString()}`,
    { method: "GET" },
  );
  if (!response || !response.ok) return null;
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) return null;
  return json.flatMap((row) => {
    const parsed = asRevisionCacheRow(row);
    return parsed ? [parsed] : [];
  });
}

export async function upsertRevisionCache(
  rows: Array<{
    projectName: string;
    sheetId: string;
    rev: string;
    checkedAt: string;
  }>,
): Promise<SheetRevisionCacheRow[] | null> {
  const config = getSupabaseServiceConfig();
  if (!config) return null;
  if (rows.length === 0) return [];

  const body = rows.map((row) => ({
    project_name: row.projectName,
    sheet_id: row.sheetId,
    rev: row.rev,
    checked_at: row.checkedAt,
  }));

  const response = await restFetch(
    config,
    `${SHEET_REVISION_CACHE_TABLE}?on_conflict=project_name,sheet_id`,
    {
      method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" },
      body: JSON.stringify(body),
    },
  );
  if (!response) return null;
  if (!response.ok) {
    console.error("[gcfieldlog] sheet_revision_cache upsert was not ok", {
      status: response.status,
    });
    return null;
  }
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) {
    const parsed = asRevisionCacheRow(json);
    return parsed ? [parsed] : [];
  }
  return json.flatMap((row) => {
    const parsed = asRevisionCacheRow(row);
    return parsed ? [parsed] : [];
  });
}

function asShareFolderRow(value: unknown): ShareFolderRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.owner_user_id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    owner_user_id: record.owner_user_id,
    name: record.name,
    created_at: record.created_at,
  };
}

function asPinnedSheetRow(value: unknown): PinnedSheetRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.folder_id !== "string" ||
    typeof record.project_name !== "string" ||
    typeof record.sheet_id !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    folder_id: record.folder_id,
    project_name: record.project_name,
    sheet_id: record.sheet_id,
    discipline: typeof record.discipline === "string" ? record.discipline : null,
    last_seen_rev: typeof record.last_seen_rev === "string" ? record.last_seen_rev : "",
    last_pulled_at:
      typeof record.last_pulled_at === "string" ? record.last_pulled_at : null,
  };
}

function asRevisionCacheRow(value: unknown): SheetRevisionCacheRow | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.project_name !== "string" ||
    typeof record.sheet_id !== "string" ||
    typeof record.rev !== "string" ||
    typeof record.checked_at !== "string"
  ) {
    return null;
  }
  return {
    id: record.id,
    project_name: record.project_name,
    sheet_id: record.sheet_id,
    rev: record.rev,
    checked_at: record.checked_at,
  };
}

async function restFetch(
  config: SupabaseServiceConfig,
  pathAndQuery: string,
  init?: RequestInit,
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${config.url}/rest/v1/${pathAndQuery}`, {
      ...init,
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.error("[gcfieldlog] share tables request failed", { aborted });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
