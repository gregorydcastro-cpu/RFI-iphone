/**
 * Rev-only compare for Mike's manual Refresh all.
 *
 * Walks pinned_sheets against sheet_revision_cache + the current known pack
 * rev (catalog / room_packs). Re-download of PDFs happens only when rev
 * bumped — this planner records the decision. Weekly cron is NOT here.
 *
 * TODO(weekly-cron): scheduled job should reuse planShareRefresh, fetch
 * Procore top rev (or bot pack), download PDF only on bump, then update
 * sheet_revision_cache.rev / checked_at and pinned_sheets.last_seen_rev /
 * last_pulled_at. Unchanged revs are metadata-only. Do not text/email Mike.
 */

import type { PinnedSheetRow, SheetRevisionCacheRow } from "./schema";
import { shareSheetKey } from "./shareCatalog";

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

export function planShareRefresh(
  pins: PinnedSheetRow[],
  cache: SheetRevisionCacheRow[],
  currentRevs: Map<string, string>,
): ShareRefreshPlan {
  const cacheByKey = new Map<string, SheetRevisionCacheRow>();
  for (const row of cache) {
    cacheByKey.set(shareSheetKey(row.project_name, row.sheet_id), row);
  }

  const items: ShareRefreshItem[] = [];
  let bumped = 0;
  let unchanged = 0;
  let missing = 0;

  for (const pin of pins) {
    const key = shareSheetKey(pin.project_name, pin.sheet_id);
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
