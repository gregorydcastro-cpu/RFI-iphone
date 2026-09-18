/**
 * Rev-only compare for Refresh all and the weekly cron.
 *
 * Walks pinned_sheets against sheet_revision_cache + the current known pack
 * rev (Maple Point catalog / live room_packs). Callers persist last_seen_rev
 * and cache on a bump. PDF re-download stays in the weekly worker.
 * Live Procore REST is the connected pack-request path — this planner
 * only records the rev decision.
 * Notify Mike after persist via notifyMikeOnBumps (issue #31), not here.
 */

import type { PinnedSheetRow, SheetRevisionCacheRow } from "./schema";

function sheetKey(projectName: string, sheetId: string): string {
  return `${projectName.trim().toLowerCase()}::${sheetId.trim().toLowerCase()}`;
}

export type ShareRefreshStatus = "bumped" | "unchanged" | "missing";

export type ShareRefreshItem = {
  pin_id: string;
  folder_id: string;
  project_name: string;
  sheet_id: string;
  previous_rev: string;
  cached_rev: string | null;
  current_rev: string | null;
  status: ShareRefreshStatus;
};

export type ShareRefreshPlan = {
  scanned: number;
  bumped: number;
  unchanged: number;
  missing: number;
  items: ShareRefreshItem[];
};

/** Persisted bump payload for issue #31 (Notify Mike). */
export type ShareRefreshBump = {
  sheet_id: string;
  old_rev: string;
  new_rev: string;
  project_name: string;
};

export type ShareRefreshError = {
  sheet_id?: string;
  project_name?: string;
  pin_id?: string;
  error: string;
};

export function bumpsFromPlan(plan: ShareRefreshPlan): ShareRefreshBump[] {
  const bumps: ShareRefreshBump[] = [];
  for (const item of plan.items) {
    if (item.status !== "bumped" || !item.current_rev) continue;
    bumps.push({
      sheet_id: item.sheet_id,
      old_rev: item.previous_rev,
      new_rev: item.current_rev,
      project_name: item.project_name,
    });
  }
  return bumps;
}

export function planShareRefresh(
  pins: PinnedSheetRow[],
  cache: SheetRevisionCacheRow[],
  currentRevs: Map<string, string>,
): ShareRefreshPlan {
  const cacheByKey = new Map<string, SheetRevisionCacheRow>();
  for (const row of cache) {
    cacheByKey.set(sheetKey(row.project_name, row.sheet_id), row);
  }

  const items: ShareRefreshItem[] = [];
  let bumped = 0;
  let unchanged = 0;
  let missing = 0;

  for (const pin of pins) {
    const key = sheetKey(pin.project_name, pin.sheet_id);
    const cached = cacheByKey.get(key) ?? null;
    const current = currentRevs.get(key) ?? null;
    const previous = cached?.rev || pin.last_seen_rev || "";
    let status: ShareRefreshStatus;
    if (!current) {
      status = "missing";
      missing += 1;
    } else if (!previous || previous !== current) {
      status = "bumped";
      bumped += 1;
    } else {
      status = "unchanged";
      unchanged += 1;
    }
    items.push({
      pin_id: pin.id,
      folder_id: pin.folder_id,
      project_name: pin.project_name,
      sheet_id: pin.sheet_id,
      previous_rev: previous,
      cached_rev: cached?.rev ?? null,
      current_rev: current,
      status,
    });
  }

  return {
    scanned: pins.length,
    bumped,
    unchanged,
    missing,
    items,
  };
}
