/**
 * `public.rfis` row shape — matches PR #9 `lib/schema.ts` (`RfiDraftRow`).
 * Share-portal tables stay in that PR. Prefer `lib/schema.ts` after #9 merges.
 *
 * Drafts go to the foreman. Never a Procore RFI submit.
 */

export const RFIS_TABLE = "rfis";

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

export function isRfiDraftStatus(value: unknown): value is RfiDraftStatus {
  return value === "draft" || value === "ready";
}
