/**
 * `public.rfis` row shape. Canonical types live in `lib/schema.ts`.
 * This file re-exports so Generate RFI (`supabaseRfis`, `/api/rfis`)
 * keeps working after the schema-foundation PR merges.
 *
 * Drafts go to the foreman. Never a Procore RFI submit.
 * Optional `markup_id` FK → `public.markup_overlays`.
 */

export {
  RFIS_TABLE,
  isRfiDraftStatus,
  type RfiDraftRow,
  type RfiDraftStatus,
} from "./schema";
