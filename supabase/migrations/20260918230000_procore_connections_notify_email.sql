-- Per-user bump-alert destination on the existing Procore connection row.
-- Issue #37: retire the global NOTIFY_MIKE_EMAIL destination.
--
-- Column: public.procore_connections.notify_email (text, nullable).
-- Null/empty means skip notify for that owner's persisted pin/sheet bumps.
-- Writes (Field Log settings API) trim + basic-validate in app code
-- (lib/notifyEmail.ts). This migration does not add a CHECK constraint so
-- empty values can be stored as NULL by the helper.
--
-- Does not alter tokens, RLS, or grants. Existing SELECT-own policy already
-- covers the new column. Service role writes notify_email (same as tokens).
-- Account/settings UI is owned by GC Field Log — not this migration.

alter table public.procore_connections
  add column if not exists notify_email text;

comment on column public.procore_connections.notify_email is
  'Per-user email for pinned-sheet revision bump alerts. Null/empty skips notify for that owner.';
