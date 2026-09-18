/**
 * `public.rfis` row shape. Canonical types live in `lib/schema.ts`.
 * This file re-exports so Generate RFI (`supabaseRfis`, `/api/rfis`)
 * keeps working after the schema-foundation PR merges.
 *
 * Drafts go to the foreman. Never a Procore RFI submit.
 */

export {
  RFIS_TABLE,
  isRfiDraftStatus,
  type RfiDraftRow,
  type RfiDraftStatus,
} from "./schema";
