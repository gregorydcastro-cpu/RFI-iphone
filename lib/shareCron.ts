/**
 * Weekly rev-only re-pull for pinned share sheets.
 *
 * Protected by CRON_SECRET (never NEXT_PUBLIC_). Reuses planShareRefresh
 * (same compare as Refresh all): Maple Point catalog + live room_packs.
 * Live Procore REST is not called — reserved behind SHARE_WEEKLY_PROCORE_REST
 * until issue #25 lands. PDF re-download uses the existing Drive/proxy path
 * only when that path is configured; otherwise metadata-only.
 * After a persisted bump, notifyMikeOnBumps emails Mike (issue #31).
 * Unchanged sheets do not notify. Missing mail env skips (503 code) and
 * does not fail the refresh.
 */

import { readGoogleDriveAuth } from "./driveAuth";
import { requestIdForPinnedSheet } from "./shareCatalog";
import { procoreRestSummary, weeklyPdfRedownloadFlag } from "./shareCronAuth";
import { notifyMikeOnBumps, type NotifyMikeSummary } from "./notifyMike";
import type {
  ShareRefreshBump,
  ShareRefreshError,
  ShareRefreshItem,
} from "./shareRefresh";
import { weeklyRefreshPinnedSheets } from "./shareStore";
import { loadSheetPdf } from "./sheetPdf";

export {
  authorizeCronHeaders,
  cronSecretConfigured,
  CRON_SECRET_KEY,
  procoreRestSummary,
  readCronSecret,
  SHARE_WEEKLY_PDF_REDOWNLOAD_FLAG,
  SHARE_WEEKLY_PROCORE_REST_FLAG,
  weeklyPdfRedownloadFlag,
  weeklyProcoreRestEnabled,
} from "./shareCronAuth";

export type WeeklyPdfSummary = {
  attempted: boolean;
  fetched: number;
  failed: number;
  skipped: number;
  todo: boolean;
  note: string;
  items: Array<{
    sheet_id: string;
    project_name: string;
    ok: boolean;
    code?: string;
  }>;
};

export type WeeklyProcoreRestSummary = ReturnType<typeof procoreRestSummary>;

export type WeeklyShareRefreshSummary = {
  ok: boolean;
  weeklyCron: true;
  notify: NotifyMikeSummary;
  scanned: number;
  bumped: number;
  unchanged: number;
  missing: number;
  errors: number;
  bumps: ShareRefreshBump[];
  error_items: ShareRefreshError[];
  items: ShareRefreshItem[];
  pdf: WeeklyPdfSummary;
  procore_rest: WeeklyProcoreRestSummary;
  storage: "supabase" | "memory";
  note: string;
};

/**
 * Safe Drive/proxy re-download is on when Drive auth exists, or when
 * SHARE_WEEKLY_PDF_REDOWNLOAD=1 (uses GET /api/sheet-pdf's loadSheetPdf).
 * SHARE_WEEKLY_PDF_REDOWNLOAD=0 forces metadata-only.
 */
export function weeklyPdfRedownloadEnabled(): boolean {
  const flag = weeklyPdfRedownloadFlag();
  if (flag !== null) return flag;
  return readGoogleDriveAuth() !== null;
}

export { requestIdForPinnedSheet };

export async function redownloadBumpedPdfs(
  bumps: ShareRefreshBump[],
): Promise<WeeklyPdfSummary> {
  if (!weeklyPdfRedownloadEnabled()) {
    return {
      attempted: false,
      fetched: 0,
      failed: 0,
      skipped: bumps.length,
      todo: true,
      note:
        "PDF re-download skipped (metadata only). Set SHARE_WEEKLY_PDF_REDOWNLOAD=1 or configure Google Drive so the existing /api/sheet-pdf proxy can fetch bumped sheets. No separate PDF store — viewer already streams via that proxy. Procore drawing download is TODO behind SHARE_WEEKLY_PROCORE_REST (issue #25).",
      items: [],
    };
  }

  const items: WeeklyPdfSummary["items"] = [];
  let fetched = 0;
  let failed = 0;
  for (const bump of bumps) {
    const requestId = requestIdForPinnedSheet(bump.project_name, bump.sheet_id);
    const result = await loadSheetPdf({ requestId, sheetId: bump.sheet_id });
    if (result.ok) {
      fetched += 1;
      items.push({
        sheet_id: bump.sheet_id,
        project_name: bump.project_name,
        ok: true,
      });
    } else {
      failed += 1;
      items.push({
        sheet_id: bump.sheet_id,
        project_name: bump.project_name,
        ok: false,
        code: result.code,
      });
    }
  }

  return {
    attempted: true,
    fetched,
    failed,
    skipped: 0,
    todo: false,
    note:
      "Fetched bumped sheet PDFs through the existing Drive/proxy path (loadSheetPdf). Bytes are not persisted — pack viewer already streams /api/sheet-pdf. There is no Procore REST download.",
    items,
  };
}

export async function runWeeklyShareRefresh(): Promise<WeeklyShareRefreshSummary> {
  const applied = await weeklyRefreshPinnedSheets();
  const pdf = await redownloadBumpedPdfs(applied.bumps);
  const errorItems = [...applied.errors];
  if (applied.load_error) {
    errorItems.push({ error: applied.load_error });
  }
  if (pdf.attempted) {
    for (const item of pdf.items) {
      if (item.ok) continue;
      errorItems.push({
        sheet_id: item.sheet_id,
        project_name: item.project_name,
        error: item.code ?? "pdf_redownload_failed",
      });
    }
  }

  const uniqueErrors = dedupeErrors(errorItems);
  const notify = applied.load_error
    ? await notifyMikeOnBumps([])
    : await notifyMikeOnBumps(applied.bumps, applied.errors);

  return {
    ok: !applied.load_error,
    weeklyCron: true,
    notify,
    scanned: applied.plan.scanned,
    bumped: applied.plan.bumped,
    unchanged: applied.plan.unchanged,
    missing: applied.plan.missing,
    errors: uniqueErrors.length,
    bumps: applied.bumps,
    error_items: uniqueErrors,
    items: applied.plan.items,
    pdf,
    procore_rest: procoreRestSummary(),
    storage: applied.storage,
    note:
      "Weekly rev-only refresh compared pinned sheets to known pack revs (same as Refresh all) and updated last_seen_rev / last_pulled_at / sheet_revision_cache on a bump. Mike is emailed only when a bump persists (NOTIFY_MIKE_EMAIL + Resend or Gmail). Unchanged sheets do not notify.",
  };
}

function dedupeErrors(errors: ShareRefreshError[]): ShareRefreshError[] {
  const seen = new Set<string>();
  const out: ShareRefreshError[] = [];
  for (const item of errors) {
    const key = `${item.pin_id ?? ""}|${item.sheet_id ?? ""}|${item.error}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
