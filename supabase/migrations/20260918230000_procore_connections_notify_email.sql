-- Per-user bump-alert destination on the existing Procore connection row.
-- Issue #37: retire the global NOTIFY_MIKE_EMAIL destination.
--
-- Column: public.procore_connections.notify_email (text, nullable).
-- Null/empty means skip notify for that owner's persisted pin/sheet bumps.
-- Writes trim + lowercase in app code (parseNotifyEmailInput /
-- upsertNotifyEmail). This migration does not add a CHECK constraint so
-- empty values can be stored as NULL by the helper.
--
-- Does not alter tokens, RLS, or grants. Existing SELECT-own policy already
-- covers the new column. Service role writes notify_email (same as tokens).
-- Account/settings UI + save API: GC Field Log agent bc-1b9bb48c.

alter table public.procore_connections
  add column if not exists notify_email text;

comment on column public.procore_connections.notify_email is
  'Per-user email for pinned-sheet revision bump alerts. Null/empty skips notify for that owner.';
