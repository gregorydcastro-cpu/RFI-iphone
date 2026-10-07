import { isDemoOrFictionalJob } from "./jobs.ts";

/**
 * Whether a pack URL should render the viewer.
 * A Supabase or Procore row counts. A local file whose id matches counts.
 * Fictional demo job ids (Maple Point, Cedar Ridge, and the other demo jobs)
 * still open the Maple Point sample. Any other id that only exists because
 * the sample was substituted is missing, so the page returns the Pack not
 * found card with HTTP 404.
 * API routes keep calling `loadLiveRoomPack` directly.
 */
export function packPageFound(input: {
  requestId: string;
  live: {
    demoFallback: boolean;
    pack: { request_id?: string | null };
  } | null;
}): boolean {
  if (!input.live) return false;
  if (!input.live.demoFallback) return true;
  if (input.live.pack.request_id === input.requestId) return true;
  return isDemoOrFictionalJob({ requestId: input.requestId });
}
