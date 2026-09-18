-- Next-layer tables for share folders, revision cache, markup overlays,
-- and trial links.
--
-- Does NOT create or alter:
--   public.procore_connections, public.room_packs (leave room_packs RLS off)
--   public.rfis — already created by 20260918021000_rfis.sql (PR #12)
--   public.billing_customers — already created by 20260918120000 (Stripe)
--   public.job_sites / workers / time_punches — 20260918093000_time_tracking
--
-- Overlay FK on rfis.markup_id is added later in
-- 20260918130000_rfis_markup_overlay_fk.sql (after rfis exists).
--
-- user_id / owner_user_id are text to match stub sessions (`stub:` + sha256)
-- and later auth.uid()::text. Until real Supabase Auth lands, website writes
-- must use SUPABASE_SERVICE_ROLE_KEY (service role bypasses RLS). Anon has
-- no access to these tables. Restrictive default: no public share-folder read.

-- ---------------------------------------------------------------------------
-- share_folders
-- ---------------------------------------------------------------------------

create table if not exists public.share_folders (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  constraint share_folders_name_not_blank check (char_length(trim(name)) > 0)
);

create unique index if not exists share_folders_owner_name_idx
  on public.share_folders (owner_user_id, lower(name));

create index if not exists share_folders_owner_user_id_idx
  on public.share_folders (owner_user_id);

alter table public.share_folders enable row level security;

revoke all on table public.share_folders from anon;
revoke all on table public.share_folders from authenticated;

grant select, insert, update, delete on table public.share_folders to authenticated;
grant all on table public.share_folders to service_role;

drop policy if exists share_folders_owner_select on public.share_folders;
drop policy if exists share_folders_owner_insert on public.share_folders;
drop policy if exists share_folders_owner_update on public.share_folders;
drop policy if exists share_folders_owner_delete on public.share_folders;

create policy share_folders_owner_select
  on public.share_folders
  for select
  to authenticated
  using (owner_user_id = (select auth.uid())::text);

create policy share_folders_owner_insert
  on public.share_folders
  for insert
  to authenticated
  with check (owner_user_id = (select auth.uid())::text);

create policy share_folders_owner_update
  on public.share_folders
  for update
  to authenticated
  using (owner_user_id = (select auth.uid())::text)
  with check (owner_user_id = (select auth.uid())::text);

create policy share_folders_owner_delete
  on public.share_folders
  for delete
  to authenticated
  using (owner_user_id = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- pinned_sheets (owned through share_folders)
-- discipline is free text: electrical / lighting / architectural / room label.
-- ---------------------------------------------------------------------------

create table if not exists public.pinned_sheets (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.share_folders (id) on delete cascade,
  project_name text not null,
  sheet_id text not null,
  discipline text,
  last_seen_rev text not null default '',
  last_pulled_at timestamptz
);

create unique index if not exists pinned_sheets_folder_project_sheet_idx
  on public.pinned_sheets (folder_id, project_name, sheet_id);

create index if not exists pinned_sheets_folder_id_idx
  on public.pinned_sheets (folder_id);

create index if not exists pinned_sheets_project_sheet_idx
  on public.pinned_sheets (project_name, sheet_id);

alter table public.pinned_sheets enable row level security;

revoke all on table public.pinned_sheets from anon;
revoke all on table public.pinned_sheets from authenticated;

grant select, insert, update, delete on table public.pinned_sheets to authenticated;
grant all on table public.pinned_sheets to service_role;

drop policy if exists pinned_sheets_owner_select on public.pinned_sheets;
drop policy if exists pinned_sheets_owner_insert on public.pinned_sheets;
drop policy if exists pinned_sheets_owner_update on public.pinned_sheets;
drop policy if exists pinned_sheets_owner_delete on public.pinned_sheets;

create policy pinned_sheets_owner_select
  on public.pinned_sheets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.share_folders f
      where f.id = pinned_sheets.folder_id
        and f.owner_user_id = (select auth.uid())::text
    )
  );

create policy pinned_sheets_owner_insert
  on public.pinned_sheets
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.share_folders f
      where f.id = pinned_sheets.folder_id
        and f.owner_user_id = (select auth.uid())::text
    )
  );

create policy pinned_sheets_owner_update
  on public.pinned_sheets
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.share_folders f
      where f.id = pinned_sheets.folder_id
        and f.owner_user_id = (select auth.uid())::text
    )
  )
  with check (
    exists (
      select 1
      from public.share_folders f
      where f.id = pinned_sheets.folder_id
        and f.owner_user_id = (select auth.uid())::text
    )
  );

create policy pinned_sheets_owner_delete
  on public.pinned_sheets
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.share_folders f
      where f.id = pinned_sheets.folder_id
        and f.owner_user_id = (select auth.uid())::text
    )
  );

-- ---------------------------------------------------------------------------
-- sheet_revision_cache (rev-only bump metadata)
-- Future weekly job (not this migration): for each pinned_sheets row, compare
-- Procore top rev to this cache. Re-download only when rev bumped; then update
-- rev + checked_at. Manual path: POST /api/share/refresh-all (stub).
-- ---------------------------------------------------------------------------

create table if not exists public.sheet_revision_cache (
  id uuid primary key default gen_random_uuid(),
  project_name text not null,
  sheet_id text not null,
  rev text not null,
  checked_at timestamptz not null default now()
);

create unique index if not exists sheet_revision_cache_project_sheet_idx
  on public.sheet_revision_cache (project_name, sheet_id);

alter table public.sheet_revision_cache enable row level security;

revoke all on table public.sheet_revision_cache from anon;
revoke all on table public.sheet_revision_cache from authenticated;
grant all on table public.sheet_revision_cache to service_role;

-- No authenticated/anon policies: deny by default. Writes require service role.

-- ---------------------------------------------------------------------------
-- markup_overlays (vector JSON: circles / boxes / arrows / text)
-- ---------------------------------------------------------------------------

create table if not exists public.markup_overlays (
  id uuid primary key default gen_random_uuid(),
  request_id text not null,
  sheet_id text not null,
  vectors jsonb not null default '{"items":[]}'::jsonb,
  user_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint markup_overlays_vectors_object check (jsonb_typeof(vectors) = 'object')
);

create unique index if not exists markup_overlays_request_sheet_user_idx
  on public.markup_overlays (request_id, sheet_id, user_id);

create index if not exists markup_overlays_user_id_idx
  on public.markup_overlays (user_id);

create index if not exists markup_overlays_request_sheet_idx
  on public.markup_overlays (request_id, sheet_id);

alter table public.markup_overlays enable row level security;

revoke all on table public.markup_overlays from anon;
revoke all on table public.markup_overlays from authenticated;

grant select, insert, update, delete on table public.markup_overlays to authenticated;
grant all on table public.markup_overlays to service_role;

drop policy if exists markup_overlays_owner_select on public.markup_overlays;
drop policy if exists markup_overlays_owner_insert on public.markup_overlays;
drop policy if exists markup_overlays_owner_update on public.markup_overlays;
drop policy if exists markup_overlays_owner_delete on public.markup_overlays;

create policy markup_overlays_owner_select
  on public.markup_overlays
  for select
  to authenticated
  using (user_id = (select auth.uid())::text);

create policy markup_overlays_owner_insert
  on public.markup_overlays
  for insert
  to authenticated
  with check (user_id = (select auth.uid())::text);

create policy markup_overlays_owner_update
  on public.markup_overlays
  for update
  to authenticated
  using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

create policy markup_overlays_owner_delete
  on public.markup_overlays
  for delete
  to authenticated
  using (user_id = (select auth.uid())::text);

-- public.rfis is owned by 20260918021000_rfis.sql (PR #12). Do not recreate
-- it here. markup_id FK is added in 20260918130000_rfis_markup_overlay_fk.sql.

-- ---------------------------------------------------------------------------
-- trial_link_tokens
-- ---------------------------------------------------------------------------

create table if not exists public.trial_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  token text not null,
  expires_at timestamptz not null,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  constraint trial_link_tokens_plan_check check (plan in ('free', 'paid')),
  constraint trial_link_tokens_token_not_blank check (char_length(trim(token)) > 0)
);

create unique index if not exists trial_link_tokens_token_idx
  on public.trial_link_tokens (token);

create index if not exists trial_link_tokens_user_id_idx
  on public.trial_link_tokens (user_id);

create index if not exists trial_link_tokens_expires_at_idx
  on public.trial_link_tokens (expires_at);

alter table public.trial_link_tokens enable row level security;

revoke all on table public.trial_link_tokens from anon;
revoke all on table public.trial_link_tokens from authenticated;

grant select, insert, update, delete on table public.trial_link_tokens to authenticated;
grant all on table public.trial_link_tokens to service_role;

drop policy if exists trial_link_tokens_owner_select on public.trial_link_tokens;
drop policy if exists trial_link_tokens_owner_insert on public.trial_link_tokens;
drop policy if exists trial_link_tokens_owner_update on public.trial_link_tokens;
drop policy if exists trial_link_tokens_owner_delete on public.trial_link_tokens;

create policy trial_link_tokens_owner_select
  on public.trial_link_tokens
  for select
  to authenticated
  using (user_id = (select auth.uid())::text);

create policy trial_link_tokens_owner_insert
  on public.trial_link_tokens
  for insert
  to authenticated
  with check (user_id = (select auth.uid())::text);

create policy trial_link_tokens_owner_update
  on public.trial_link_tokens
  for update
  to authenticated
  using (user_id = (select auth.uid())::text)
  with check (user_id = (select auth.uid())::text);

create policy trial_link_tokens_owner_delete
  on public.trial_link_tokens
  for delete
  to authenticated
  using (user_id = (select auth.uid())::text);
