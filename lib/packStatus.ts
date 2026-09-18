import type { DemoJob } from "./jobs";
import type { RoomPack } from "./pack";

export type PackStatusSource = "supabase" | "local" | "none";

/**
 * Hard rule: never display another job's pack.
 * Match slug or exact project name; request_id when present must match
 * this request or the job slug (room packs are often stored under the job).
 */
export function requestBelongsToJob(
  job: DemoJob,
  requestId: string,
): boolean {
  return requestId === job.slug || requestId.startsWith(`${job.slug}-`);
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

export function packMatchesJob(
  pack: RoomPack,
  job: DemoJob,
  requestId: string,
): boolean {
  const slugOk =
    typeof pack.project.slug === "string" && pack.project.slug === job.slug;
  const nameOk = pack.project.name === job.name;
  if (!slugOk && !nameOk) return false;
  if (
    pack.request_id &&
    pack.request_id !== requestId &&
    pack.request_id !== job.slug
  ) {
    return false;
  }
  return true;
}
