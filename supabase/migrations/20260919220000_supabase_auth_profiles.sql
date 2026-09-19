-- Real Supabase Auth. user_id / owner_user_id / created_by store
-- auth.uid()::text (uuid). Leftover stub:sha256 rows are not used.
-- Role lives in public.profiles and auth.users.raw_app_meta_data.
-- Never authorize from raw_user_meta_data (user-editable).
--
-- Does NOT recreate existing tables. Additive profiles + RLS tighten.
-- Apply on the gc-field-log Supabase project. This repo does not auto-apply.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  role text not null default 'puller',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('viewer', 'full', 'puller')),
  constraint profiles_email_normalized check (
    email is null or email = lower(trim(email))
  )
);

create index if not exists profiles_email_idx
  on public.profiles (lower(email));

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

drop policy if exists profiles_select_own on public.profiles;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = private, public
as $$
declare
  claimed text;
begin
  claimed := nullif(trim(both from coalesce(new.raw_app_meta_data ->> 'role', '')), '');
  if claimed is null or claimed not in ('viewer', 'full', 'puller') then
    claimed := 'puller';
  end if;
  insert into public.profiles (id, email, role)
  values (new.id, lower(trim(both from coalesce(new.email, ''))), claimed)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;
revoke all on function private.handle_new_user() from anon;
revoke all on function private.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- time_punches.user_id = auth.uid() of the recorder (RLS).
alter table public.time_punches
  add column if not exists user_id text;

create index if not exists time_punches_user_id_idx
  on public.time_punches (user_id);

drop policy if exists job_sites_select_authenticated on public.job_sites;
drop policy if exists workers_select_authenticated on public.workers;
drop policy if exists time_punches_select_authenticated on public.time_punches;
drop policy if exists time_punches_insert_authenticated on public.time_punches;
drop policy if exists time_punches_update_authenticated on public.time_punches;

create policy job_sites_select_authenticated
  on public.job_sites
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy workers_select_authenticated
  on public.workers
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy time_punches_select_authenticated
  on public.time_punches
  for select
  to authenticated
  using ((select auth.uid()) is not null);

create policy time_punches_insert_authenticated
  on public.time_punches
  for insert
  to authenticated
  with check (user_id = (select auth.uid())::text);

create policy time_punches_update_authenticated
  on public.time_punches
  for update
  to authenticated
  using (
    user_id = (select auth.uid())::text
    or user_id is null
  )
  with check (user_id = (select auth.uid())::text);

-- billing_customers.user_id so SELECT can match auth.uid() as well as JWT email.
alter table public.billing_customers
  add column if not exists user_id text;

create index if not exists billing_customers_user_id_idx
  on public.billing_customers (user_id);

drop policy if exists users_read_own_billing_customer on public.billing_customers;

create policy users_read_own_billing_customer
  on public.billing_customers
  for select
  to authenticated
  using (
    (
      user_id is not null
      and user_id = (select auth.uid())::text
    )
    or lower(coalesce(email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

-- Re-assert owner RLS on tables that already used auth.uid()::text.
-- Leftover stub: rows will not match a real session (start-fresh MVP).

drop policy if exists users_read_own_procore_connection on public.procore_connections;
create policy users_read_own_procore_connection
  on public.procore_connections
  for select
  to authenticated
  using (user_id = (select auth.uid())::text);

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
