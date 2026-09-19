/**
 * Row types for GC Field Log tables.
 *
 * Already on main (do not recreate):
 *   public.procore_connections — per-user Procore OAuth tokens
 *   public.room_packs — live pack snapshots from the Procore bot
 *   public.rfis — draft RFIs from PR #12 (`20260918021000_rfis.sql`)
 *   public.job_sites / workers / time_punches — Time tab
 *   public.billing_customers — Stripe Checkout (`20260918120000`)
 *
 * New (supabase/migrations/20260918020000_share_markup_rfi_trial.sql):
 *   share_folders, pinned_sheets, sheet_revision_cache,
 *   markup_overlays, trial_link_tokens
 *
 * Crew invites: supabase/migrations/20260919010000_invite_tokens.sql
 * Auth profiles: supabase/migrations/20260919220000_supabase_auth_profiles.sql
 *   public.invite_tokens — NEW table (not `invites`, not trial_link_tokens).
 *   role is viewer | full. Redeem writes that role onto profiles / app_metadata.
 *
 * Overlay FK: supabase/migrations/20260918130000_rfis_markup_overlay_fk.sql
 * attaches rfis.markup_id → markup_overlays. Row shape stays RfiDraftRow
 * (same columns as lib/rfiSchema.ts / Generate RFI).
 *
 * notify_email: supabase/migrations/20260918230000_procore_connections_notify_email.sql
 * adds nullable procore_connections.notify_email (per-user bump alerts).
 *
 * Bot wake queue: supabase/migrations/20260919120000_procore_bot_requests.sql
 *   public.procore_bot_requests — website enqueue; fleet polls / claims.
 *
 * Authenticated RLS matches auth.uid()::text. Service role still writes
 * tokens, webhooks, cron, and bot-wake rows. Anon has no grants on the new tables.
 */

export type { RoomPackRow } from "./supabaseRoomPack";

export const SHARE_FOLDERS_TABLE = "share_folders";
export const PINNED_SHEETS_TABLE = "pinned_sheets";
export const SHEET_REVISION_CACHE_TABLE = "sheet_revision_cache";
export const MARKUP_OVERLAYS_TABLE = "markup_overlays";
export const RFIS_TABLE = "rfis";
export const TRIAL_LINK_TOKENS_TABLE = "trial_link_tokens";
export const INVITE_TOKENS_TABLE = "invite_tokens";
export const PROFILES_TABLE = "profiles";
export const PROCORE_CONNECTIONS_TABLE_NAME = "procore_connections";
export const ROOM_PACKS_TABLE = "room_packs";
export const PROCORE_BOT_REQUESTS_TABLE = "procore_bot_requests";

export type ProcoreBotRequestStatus = "queued" | "claimed" | "done" | "error";

export type ProcoreBotRequestRow = {
  id: string;
  bot_id: string;
  project_name: string;
  room: string;
  request_id: string;
  reason: string | null;
  status: ProcoreBotRequestStatus;
  payload: Record<string, unknown>;
  created_at: string;
};

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
  /**
   * Per-user bump-alert destination (issue #37). Null/empty skips notify
   * for this owner's persisted pin/sheet bumps. Not the login email.
   */
  notify_email: string | null;
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
 * Weekly cron (`GET`/`POST /api/share/weekly-refresh`) and manual
 * `POST /api/share/refresh-all` both walk pins against this cache and
 * update `rev` / `checked_at` when the known pack rev changes.
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

/** Same row as `public.rfis` from PR #12. `markup_id` is optional overlay FK. */
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

export function isRfiDraftStatus(value: unknown): value is RfiDraftStatus {
  return value === "draft" || value === "ready";
}

export type TrialLinkPlan = "free" | "paid";

export type TrialLinkTokenRow = {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  plan: TrialLinkPlan;
  created_at: string;
};

/** Baked into `invite_tokens.role`. `full` is the normal crew dashboard. */
export type InviteRole = "viewer" | "full";

export const INVITE_ROLES: readonly InviteRole[] = ["viewer", "full"];

export type InviteTokenRow = {
  id: string;
  token: string;
  role: InviteRole;
  created_by: string;
  invitee_email: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};
