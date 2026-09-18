/**
 * Row types for GC Field Log tables.
 *
 * Existing (do not recreate):
 *   public.procore_connections — per-user Procore OAuth tokens
 *   public.room_packs — live pack snapshots from the Procore bot
 *
 * New (supabase/migrations/20260918020000_share_markup_rfi_trial.sql):
 *   share_folders, pinned_sheets, sheet_revision_cache,
 *   markup_overlays, rfis, trial_link_tokens
 *
 * Writes that must succeed under the stub session (`stub:` + sha256 email)
 * require SUPABASE_SERVICE_ROLE_KEY. Authenticated RLS matches auth.uid()
 * once real auth lands. Anon has no grants on the new tables.
 */

export type { RoomPackRow } from "./supabaseRoomPack";

export const SHARE_FOLDERS_TABLE = "share_folders";
export const PINNED_SHEETS_TABLE = "pinned_sheets";
export const SHEET_REVISION_CACHE_TABLE = "sheet_revision_cache";
export const MARKUP_OVERLAYS_TABLE = "markup_overlays";
export const RFIS_TABLE = "rfis";
export const TRIAL_LINK_TOKENS_TABLE = "trial_link_tokens";
export const PROCORE_CONNECTIONS_TABLE_NAME = "procore_connections";
export const ROOM_PACKS_TABLE = "room_packs";

/** Already present. Service role writes; never expose tokens via the anon key. */
export type ProcoreConnectionRow = {
  user_id: string;
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  /** Last-known from GET /me only. Resolve company id per project. */
  company_id: string | null;
  procore_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ShareFolderRow = {
  id: string;
  owner_user_id: string;
  name: string;
  created_at: string;
};

/** Usual viewer-portal pin groups. SQL `discipline` stays free text. */
export const PINNED_SHEET_DISCIPLINES = [
  "electrical",
  "lighting",
  "architectural",
] as const;

export type PinnedSheetDiscipline =
  (typeof PINNED_SHEET_DISCIPLINES)[number];

export type PinnedSheetRow = {
  id: string;
  folder_id: string;
  project_name: string;
  sheet_id: string;
  /** electrical / lighting / architectural, or a room label. */
  discipline: string | null;
  last_seen_rev: string;
  last_pulled_at: string | null;
};

/**
 * Last-seen Procore rev for bump detection. Service-role writes.
 * Future weekly job reads this table and re-downloads a sheet only when
 * `rev` changed; not implemented in this PR.
 */
export type SheetRevisionCacheRow = {
  id: string;
  project_name: string;
  sheet_id: string;
  rev: string;
  checked_at: string;
};

export type MarkupKind = "circle" | "box" | "arrow" | "text";

/** Normalized 0–1 coordinates, origin top-left (same space as pack layout). */
export type MarkupCircle = {
  id: string;
  kind: "circle";
  cx: number;
  cy: number;
  r: number;
};

export type MarkupBox = {
  id: string;
  kind: "box";
  x: number;
  y: number;
  w: number;
  h: number;
};

export type MarkupArrow = {
  id: string;
  kind: "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type MarkupTextNote = {
  id: string;
  kind: "text";
  x: number;
  y: number;
  text: string;
};

export type MarkupVector =
  | MarkupCircle
  | MarkupBox
  | MarkupArrow
  | MarkupTextNote;

export type MarkupVectorsJson = {
  items: MarkupVector[];
};

export type MarkupOverlayRow = {
  id: string;
  /** Pack / request id (`room_packs.request_id` / pack JSON `request_id`). */
  request_id: string;
  sheet_id: string;
  vectors: MarkupVectorsJson;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type RfiDraftStatus = "draft" | "ready";

export type RfiDraftRow = {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  location: string | null;
  sheet_id: string | null;
  markup_id: string | null;
  status: RfiDraftStatus;
  created_at: string;
  updated_at: string;
};

export type TrialLinkPlan = "free" | "paid";

export type TrialLinkTokenRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  plan: TrialLinkPlan;
  created_at: string;
};
