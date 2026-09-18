-- Compatible `public.rfis` draft table (PR #9 shape).
--
-- Columns match `supabase/migrations/20260918020000_share_markup_rfi_trial.sql`
-- in the schema-foundation PR. This file does NOT create share_folders,
-- pinned_sheets, sheet_revision_cache, markup_overlays, or trial_link_tokens.
--
-- `create table if not exists`: if #9 already applied, this is a no-op.
-- `markup_id` is uuid without an FK so this migration does not require
-- markup_overlays. After #9 merges, that PR may add the overlay FK.
--
-- Does not alter procore_connections or room_packs.
-- Stub-session writes (`stub:` + sha256 email) need SUPABASE_SERVICE_ROLE_KEY.
-- Anon has no grants. Status is draft | ready — never a Procore submit.

create table if not exists public.rfis (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  subject text not null default '',
  description text not null default '',
  location text,
  sheet_id text,
  markup_id uuid,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rfis_status_check check (status in ('draft', 'ready'))
);

create index if not exists rfis_user_id_idx
  on public.rfis (user_id);

create index if not exists rfis_markup_id_idx
  on public.rfis (markup_id);

alter table public.rfis enable row level security;

revoke all on table public.rfis from anon;
revoke all on table public.rfis from authenticated;

grant select, insert, update, delete on table public.rfis to authenticated;
grant all on table public.rfis to service_role;

drop policy if exists rfis_owner_select on public.rfis;
drop policy if exists rfis_owner_insert on public.rfis;
drop policy if exists rfis_owner_update on public.rfis;
drop policy if exists rfis_owner_delete on public.rfis;

create policy rfis_owner_select
  on public.rfis
  for select
  to authenticated
  using (user_id = (select auth.uid())::text);

create policy rfis_owner_insert
  on public.rfis
  for insert
  to authenticated
  with check (user_id = (select auth.uid())::text);

create policy rfis_owner_update
  on public.rfis
  for update
  to authenticated
  using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

create policy rfis_owner_delete
  on public.rfis
  for delete
  to authenticated
  using (user_id = (select auth.uid())::text);
