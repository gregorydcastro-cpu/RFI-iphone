/**
 * Share-folder portal store.
 *
 * Local / unset service role: in-memory folders + pins (process lifetime).
 * Service role configured: persist to share_folders / pinned_sheets /
 * sheet_revision_cache under the stub session owner_user_id.
 *
 * Manual Refresh all walks one owner's pins. Weekly cron walks every pin
 * (service role) and reuses the same compare + cache write. Notify looks
 * up procore_connections.notify_email for each pin folder's owner_user_id
 * after persist — not from this store.
 */

import {
  catalogRevMap,
  MAPLE_POINT_PROJECT_NAME,
  MAPLE_POINT_REQUEST_ID,
  SHARE_CATALOG,
  shareSheetKey,
  type SharePinDraft,
} from "./shareCatalog";
import {
  bumpsFromPlan,
  planShareRefresh,
  type ShareRefreshBump,
  type ShareRefreshError,
  type ShareRefreshPlan,
} from "./shareRefresh";
import type { PinnedSheetRow, ShareFolderRow, SheetRevisionCacheRow } from "./schema";
import { fetchLatestRoomPackRow, getSupabaseConfig, roomPackFromRow } from "./supabaseRoomPack";
import {
  deletePinnedSheet,
  deleteShareFolder,
  insertShareFolder,
  isShareTableWriteConfigured,
  selectAllPinnedSheets,
  selectAllRevisionCache,
  selectAllShareFolders,
  selectPinnedSheets,
  selectRevisionCache,
  selectShareFolders,
  updatePinnedSheetRev,
  upsertPinnedSheets,
  upsertRevisionCache,
} from "./supabaseShare";

export type ShareStorage = "supabase" | "memory";

export type ShareFolderWithPins = ShareFolderRow & {
  pins: PinnedSheetRow[];
};

export type SharePortalSnapshot = {
  folders: ShareFolderWithPins[];
  storage: ShareStorage;
};

type MemoryShare = {
  folders: ShareFolderRow[];
  pins: PinnedSheetRow[];
  cache: SheetRevisionCacheRow[];
};

const g = globalThis as typeof globalThis & { __gcFieldLogShare?: MemoryShare };

function memory(): MemoryShare {
  if (!g.__gcFieldLogShare) {
    g.__gcFieldLogShare = { folders: [], pins: [], cache: [] };
  }
  return g.__gcFieldLogShare;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
}

function nestFolders(
  folders: ShareFolderRow[],
  pins: PinnedSheetRow[],
): ShareFolderWithPins[] {
  return folders.map((folder) => ({
    ...folder,
    pins: pins.filter((pin) => pin.folder_id === folder.id),
  }));
}

export async function listSharePortal(
  ownerUserId: string,
): Promise<SharePortalSnapshot> {
  const configured = isShareTableWriteConfigured();
  if (configured) {
    const folders = await selectShareFolders(ownerUserId);
    if (folders) {
      const pins = (await selectPinnedSheets(folders.map((folder) => folder.id))) ?? [];
      return { folders: nestFolders(folders, pins), storage: "supabase" };
    }
  }
  const store = memory();
  const folders = store.folders.filter((folder) => folder.owner_user_id === ownerUserId);
  return { folders: nestFolders(folders, store.pins), storage: "memory" };
}

export async function createShareFolder(input: {
  ownerUserId: string;
  name: string;
}): Promise<{ folder: ShareFolderRow; storage: ShareStorage } | { error: string; status: number }> {
  const name = input.name.trim();
  if (!name) return { error: "Folder name is required", status: 400 };

  const configured = isShareTableWriteConfigured();
  if (configured) {
    const existing = await selectShareFolders(input.ownerUserId);
    if (existing?.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) {
      return { error: "A folder with that name already exists", status: 409 };
    }
    const folder = await insertShareFolder({
      ownerUserId: input.ownerUserId,
      name,
    });
    if (folder) return { folder, storage: "supabase" };
    return { error: "Could not create folder", status: 503 };
  }

  const store = memory();
  const duplicate = store.folders.some(
    (folder) =>
      folder.owner_user_id === input.ownerUserId &&
      folder.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) return { error: "A folder with that name already exists", status: 409 };
  const now = new Date().toISOString();
  const folder: ShareFolderRow = {
    id: newId(),
    owner_user_id: input.ownerUserId,
    name,
    created_at: now,
  };
  store.folders.unshift(folder);
  return { folder, storage: "memory" };
}

export async function removeShareFolder(input: {
  ownerUserId: string;
  folderId: string;
}): Promise<{ ok: true; storage: ShareStorage } | { error: string; status: number }> {
  const configured = isShareTableWriteConfigured();
  if (configured) {
    const folders = await selectShareFolders(input.ownerUserId);
    const owned = folders?.some((folder) => folder.id === input.folderId);
    if (!owned) return { error: "Folder not found", status: 404 };
    const deleted = await deleteShareFolder({
      id: input.folderId,
      ownerUserId: input.ownerUserId,
    });
    if (!deleted) return { error: "Could not delete folder", status: 503 };
    return { ok: true, storage: "supabase" };
  }

  const store = memory();
  const index = store.folders.findIndex(
    (folder) => folder.id === input.folderId && folder.owner_user_id === input.ownerUserId,
  );
  if (index < 0) return { error: "Folder not found", status: 404 };
  store.folders.splice(index, 1);
  store.pins = store.pins.filter((pin) => pin.folder_id !== input.folderId);
  return { ok: true, storage: "memory" };
}

export async function pinSheetsToFolder(input: {
  ownerUserId: string;
  folderId: string;
  drafts: SharePinDraft[];
}): Promise<
  | { pins: PinnedSheetRow[]; added: number; storage: ShareStorage }
  | { error: string; status: number }
> {
  if (input.drafts.length === 0) {
    return { error: "Nothing to pin", status: 400 };
  }

  const snapshot = await listSharePortal(input.ownerUserId);
  const folder = snapshot.folders.find((row) => row.id === input.folderId);
  if (!folder) return { error: "Folder not found", status: 404 };

  const existingKeys = new Set(
    folder.pins.map((pin) => shareSheetKey(pin.project_name, pin.sheet_id)),
  );
  const uniqueDrafts: SharePinDraft[] = [];
  const seen = new Set<string>();
  for (const draft of input.drafts) {
    const key = shareSheetKey(draft.project_name, draft.sheet_id);
    if (seen.has(key) || existingKeys.has(key)) continue;
    seen.add(key);
    uniqueDrafts.push(draft);
  }

  if (snapshot.storage === "supabase" && isShareTableWriteConfigured()) {
    if (uniqueDrafts.length === 0) {
      return { pins: folder.pins, added: 0, storage: "supabase" };
    }
    const inserted = await upsertPinnedSheets(
      uniqueDrafts.map((draft) => ({
        folderId: input.folderId,
        projectName: draft.project_name,
        sheetId: draft.sheet_id,
        discipline: draft.discipline,
        lastSeenRev: draft.last_seen_rev,
      })),
    );
    if (!inserted) return { error: "Could not pin sheets", status: 503 };
    const pins = (await selectPinnedSheets([input.folderId])) ?? [...folder.pins, ...inserted];
    return { pins, added: inserted.length, storage: "supabase" };
  }

  const store = memory();
  const added: PinnedSheetRow[] = uniqueDrafts.map((draft) => ({
    id: newId(),
    folder_id: input.folderId,
    project_name: draft.project_name,
    sheet_id: draft.sheet_id,
    discipline: draft.discipline,
    last_seen_rev: draft.last_seen_rev,
    last_pulled_at: null,
  }));
  store.pins.push(...added);
  const pins = store.pins.filter((pin) => pin.folder_id === input.folderId);
  return { pins, added: added.length, storage: "memory" };
}

export async function unpinSheet(input: {
  ownerUserId: string;
  pinId: string;
}): Promise<{ ok: true; storage: ShareStorage } | { error: string; status: number }> {
  const snapshot = await listSharePortal(input.ownerUserId);
  const ownedIds = snapshot.folders.map((folder) => folder.id);
  const pin = snapshot.folders.flatMap((folder) => folder.pins).find((row) => row.id === input.pinId);
  if (!pin) return { error: "Pinned sheet not found", status: 404 };

  if (snapshot.storage === "supabase" && isShareTableWriteConfigured()) {
    const deleted = await deletePinnedSheet({ id: input.pinId, folderIds: ownedIds });
    if (!deleted) return { error: "Could not unpin sheet", status: 503 };
    return { ok: true, storage: "supabase" };
  }

  const store = memory();
  store.pins = store.pins.filter((row) => row.id !== input.pinId);
  return { ok: true, storage: "memory" };
}

/** Known pack revs: Maple Point catalog, plus live room_packs when configured. */
export async function currentShareRevMap(): Promise<Map<string, string>> {
  const map = catalogRevMap(SHARE_CATALOG);
  if (!getSupabaseConfig()) return map;
  const row = await fetchLatestRoomPackRow({
    requestId: MAPLE_POINT_REQUEST_ID,
    projectName: MAPLE_POINT_PROJECT_NAME,
    projectSlug: "maple-point",
  });
  const pack = row ? roomPackFromRow(row) : null;
  if (!pack) return map;
  const projectName = pack.project?.name?.trim() || MAPLE_POINT_PROJECT_NAME;
  for (const sheet of pack.sheets) {
    if (!sheet.id) continue;
    map.set(shareSheetKey(projectName, sheet.id), sheet.rev || "");
  }
  return map;
}

export type ShareRefreshApplyResult = {
  plan: ShareRefreshPlan;
  storage: ShareStorage;
  bumps: ShareRefreshBump[];
  errors: ShareRefreshError[];
};

async function persistRefreshPlan(input: {
  plan: ShareRefreshPlan;
  storage: ShareStorage;
  now: string;
}): Promise<ShareRefreshError[]> {
  const errors: ShareRefreshError[] = [];

  if (input.storage === "supabase" && isShareTableWriteConfigured()) {
    const cacheWrites = input.plan.items
      .filter((item) => item.current_rev)
      .map((item) => ({
        projectName: item.project_name,
        sheetId: item.sheet_id,
        rev: item.current_rev as string,
        checkedAt: input.now,
      }));
    if (cacheWrites.length > 0) {
      const written = await upsertRevisionCache(cacheWrites);
      if (!written) {
        errors.push({ error: "sheet_revision_cache upsert failed" });
      }
    }
    for (const item of input.plan.items) {
      if (item.status !== "bumped" || !item.current_rev) continue;
      const ok = await updatePinnedSheetRev({
        id: item.pin_id,
        lastSeenRev: item.current_rev,
        lastPulledAt: input.now,
      });
      if (!ok) {
        errors.push({
          pin_id: item.pin_id,
          sheet_id: item.sheet_id,
          project_name: item.project_name,
          error: "pinned_sheets rev patch failed",
        });
      }
    }
    return errors;
  }

  const store = memory();
  for (const item of input.plan.items) {
    if (!item.current_rev) continue;
    const key = shareSheetKey(item.project_name, item.sheet_id);
    const existing = store.cache.findIndex(
      (row) => shareSheetKey(row.project_name, row.sheet_id) === key,
    );
    const next: SheetRevisionCacheRow = {
      id: existing >= 0 ? store.cache[existing].id : newId(),
      project_name: item.project_name,
      sheet_id: item.sheet_id,
      rev: item.current_rev,
      checked_at: input.now,
    };
    if (existing >= 0) store.cache[existing] = next;
    else store.cache.push(next);
    if (item.status === "bumped") {
      const pin = store.pins.find((row) => row.id === item.pin_id);
      if (pin) {
        pin.last_seen_rev = item.current_rev;
        pin.last_pulled_at = input.now;
      } else {
        errors.push({
          pin_id: item.pin_id,
          sheet_id: item.sheet_id,
          project_name: item.project_name,
          error: "pinned sheet not found in memory store",
        });
      }
    }
  }
  return errors;
}

export async function refreshAllPinnedSheets(
  ownerUserId: string,
): Promise<ShareRefreshApplyResult> {
  const snapshot = await listSharePortal(ownerUserId);
  const pins = snapshot.folders.flatMap((folder) => folder.pins);
  const currentRevs = await currentShareRevMap();
  const now = new Date().toISOString();

  let cache: SheetRevisionCacheRow[] = [];
  if (snapshot.storage === "supabase" && isShareTableWriteConfigured()) {
    const projectNames = [...new Set(pins.map((pin) => pin.project_name))];
    cache = (await selectRevisionCache(projectNames)) ?? [];
  } else {
    cache = memory().cache;
  }

  const plan = planShareRefresh(pins, cache, currentRevs);
  const errors = await persistRefreshPlan({
    plan,
    storage: snapshot.storage,
    now,
  });
  return {
    plan,
    storage: snapshot.storage,
    bumps: bumpsFromPlan(plan, ownerByFolderId(snapshot.folders)),
    errors,
  };
}

export async function weeklyRefreshPinnedSheets(): Promise<
  ShareRefreshApplyResult & { load_error?: string }
> {
  const configured = isShareTableWriteConfigured();
  let pins: PinnedSheetRow[] = [];
  let cache: SheetRevisionCacheRow[] = [];
  let folders: ShareFolderRow[] = [];
  let storage: ShareStorage = "memory";

  if (configured) {
    const allPins = await selectAllPinnedSheets();
    const allCache = await selectAllRevisionCache();
    if (!allPins || !allCache) {
      return {
        plan: { scanned: 0, bumped: 0, unchanged: 0, missing: 0, items: [] },
        storage: "supabase",
        bumps: [],
        errors: [
          {
            error:
              "Could not read pinned_sheets / sheet_revision_cache with the service role.",
          },
        ],
        load_error:
          "Could not read pinned_sheets / sheet_revision_cache with the service role.",
      };
    }
    pins = allPins;
    cache = allCache;
    folders = (await selectAllShareFolders()) ?? [];
    storage = "supabase";
  } else {
    const store = memory();
    pins = store.pins;
    cache = store.cache;
    folders = store.folders;
  }

  const currentRevs = await currentShareRevMap();
  const plan = planShareRefresh(pins, cache, currentRevs);
  const errors = await persistRefreshPlan({
    plan,
    storage,
    now: new Date().toISOString(),
  });
  return {
    plan,
    storage,
    bumps: bumpsFromPlan(plan, ownerByFolderId(folders)),
    errors,
  };
}

function ownerByFolderId(
  folders: Array<{ id: string; owner_user_id: string }>,
): Map<string, string> {
  return new Map(folders.map((folder) => [folder.id, folder.owner_user_id]));
}

