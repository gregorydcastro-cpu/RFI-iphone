import type { DemoJob } from "./jobs";
import type { RoomPack } from "./pack";

/** Ops folder (not a credential). Layout: `{project_slug}/{request_id}.json`. */
export const DRIVE_ROOM_PACK_ROOT_ID = "19Ixner0dApGlfpG13M2XOw2rzReQGl3P";

export const DRIVE_ROOM_PACK_ROOT_URL = `https://drive.google.com/drive/folders/${DRIVE_ROOM_PACK_ROOT_ID}`;

/**
 * Optional public JSON / status URL template. Not on Vercel Production today.
 * Placeholders: `{project_slug}`, `{request_id}`, `{path}`.
 */
export const PROCORE_ROOM_PACK_STATUS_URL_KEY =
  "procore_room_pack_status_url" as const;

export const PACK_STATUS_SESSION_KEY_PREFIX = "gcfieldlog:pack-status-url:";

export type PackPollState = "pending" | "ready" | "error";

export type PackStatusSource = "local" | "http" | "stub";

export type PackStatusSnapshot = {
  state: PackPollState;
  source: PackStatusSource;
  /** Drive object path under the room-packs root. */
  drivePath: string;
  pack: RoomPack | null;
  /** Live path should keep polling. */
  poll: boolean;
  /** True when no HTTP/Drive fetch target is configured. */
  unconfigured: boolean;
  error?: string;
};

export function drivePackJsonPath(
  projectSlug: string,
  requestId: string,
): string {
  return `${projectSlug}/${requestId}.json`;
}

export function packStatusSessionKey(requestId: string): string {
  return `${PACK_STATUS_SESSION_KEY_PREFIX}${requestId}`;
}

export function requestBelongsToJob(
  job: DemoJob,
  requestId: string,
): boolean {
  return requestId === job.slug || requestId.startsWith(`${job.slug}-`);
}

/**
 * Expand a public JSON URL template. Unknown placeholders are left as-is.
 */
export function resolveStatusUrlTemplate(
  template: string,
  input: { projectSlug: string; requestId: string },
): string {
  const path = drivePackJsonPath(input.projectSlug, input.requestId);
  return template
    .replaceAll("{project_slug}", encodeURIComponent(input.projectSlug))
    .replaceAll("{request_id}", encodeURIComponent(input.requestId))
    .replaceAll("{path}", path);
}

export function pickStatusUrlFromWebhookBody(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const rec = body as Record<string, unknown>;
  for (const key of ["status_url", "json_url", "pack_url"] as const) {
    const value = rec[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
      }
    }
  }
  return undefined;
}

export function isRoomPackShape(value: unknown): value is RoomPack {
  if (!value || typeof value !== "object") return false;
  const pack = value as Partial<RoomPack>;
  if (typeof pack.status !== "string") return false;
  if (!pack.project || typeof pack.project !== "object") return false;
  if (typeof pack.project.name !== "string") return false;
  if (!pack.room || typeof pack.room !== "object") return false;
  if (!Array.isArray(pack.sheets)) return false;
  return true;
}

/**
 * Hard rule: never display another job's pack.
 * Match slug or exact project name; request_id when present must match.
 */
export function packMatchesJob(
  pack: RoomPack,
  job: DemoJob,
  requestId: string,
): boolean {
  const slugOk =
    typeof pack.project.slug === "string" && pack.project.slug === job.slug;
  const nameOk = pack.project.name === job.name;
  if (!slugOk && !nameOk) return false;
  if (pack.request_id && pack.request_id !== requestId) return false;
  return true;
}
