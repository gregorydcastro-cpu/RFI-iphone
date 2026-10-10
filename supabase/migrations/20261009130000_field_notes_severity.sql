-- Field notes: one feed. Safety is a severity on every note, not its own category.
--
-- Base columns (room, location, photos, author, created_at) stay.
-- New columns default so existing notes become severity routine, status open.
-- Downgrade FROM safety without a reason is rejected in the database.
-- Notes do not name a person to assign. There is no opt-in alert switch.
-- severity = safety is what alerts. This file does not send mail.
--
-- Fictional demo jobs only: maple-point, cedar-ridge.
-- Do not apply this file from the app. Greg applies it when ready.

create table if not exists public.field_notes (
  id uuid primary key default gen_random_uuid(),
  job_slug text not null,
  room text,
  location text,
  body text not null default '',
  photos jsonb not null default '[]'::jsonb,
  author_user_id text not null,
  author_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.field_notes
  add column if not exists severity text not null default 'routine',
  add column if not exists hazard_type text,
  add column if not exists symptoms_reported boolean not null default false,
  add column if not exists stop_work boolean not null default false,
  add column if not exists status text not null default 'open',
  add column if not exists acknowledged_by text,
  add column if not exists acknowledged_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text,
  add column if not exists severity_changed_by text,
  add column if not exists severity_changed_at timestamptz,
  add column if not exists severity_change_reason text,
  add column if not exists foreman_alerted_at timestamptz,
  add column if not exists gc_escalated_at timestamptz,
  add column if not exists unacked_realerted_at timestamptz,
  add column if not exists mitigated_at timestamptz,
  add column if not exists mitigated_reminded_at timestamptz;

alter table public.field_notes drop constraint if exists field_notes_severity_check;
alter table public.field_notes
  add constraint field_notes_severity_check
  check (severity in ('routine', 'priority', 'safety'));

alter table public.field_notes drop constraint if exists field_notes_status_check;
alter table public.field_notes
  add constraint field_notes_status_check
  check (status in ('open', 'acknowledged', 'mitigated', 'closed'));

alter table public.field_notes drop constraint if exists field_notes_hazard_type_check;
alter table public.field_notes
  add constraint field_notes_hazard_type_check
  check (
    hazard_type is null
    or hazard_type in ('air_quality', 'fall', 'electrical', 'fire', 'struck_by', 'other')
  );

alter table public.field_notes drop constraint if exists field_notes_safety_hazard_check;
alter table public.field_notes
  add constraint field_notes_safety_hazard_check
  check (severity <> 'safety' or hazard_type is not null);

alter table public.field_notes drop constraint if exists field_notes_photos_array_check;
alter table public.field_notes
  add constraint field_notes_photos_array_check
  check (jsonb_typeof(photos) = 'array');

alter table public.field_notes drop constraint if exists field_notes_demo_job_check;
alter table public.field_notes
  add constraint field_notes_demo_job_check
  check (job_slug in ('maple-point', 'cedar-ridge'));

create index if not exists field_notes_job_created_idx
  on public.field_notes (job_slug, created_at desc);

create index if not exists field_notes_safety_active_idx
  on public.field_notes (job_slug, created_at)
  where severity = 'safety' and status <> 'closed';

create or replace function public.field_notes_guard_safety_downgrade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();

  if old.severity = 'safety' and new.severity is distinct from 'safety' then
    if new.severity_change_reason is null or length(btrim(new.severity_change_reason)) = 0 then
      raise exception 'downgrade_from_safety_requires_reason'
        using errcode = '23514';
    end if;
    if new.severity_changed_by is null or length(btrim(new.severity_changed_by)) = 0 then
      raise exception 'downgrade_from_safety_requires_actor'
        using errcode = '23514';
    end if;
    if new.severity_changed_at is null then
      new.severity_changed_at := now();
    end if;
  end if;

  if new.severity = 'safety' and new.hazard_type is null then
    raise exception 'safety_requires_hazard_type'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists field_notes_guard_safety on public.field_notes;
create trigger field_notes_guard_safety
  before update on public.field_notes
  for each row
  execute function public.field_notes_guard_safety_downgrade();

alter table public.field_notes enable row level security;

revoke all on table public.field_notes from anon;
revoke all on table public.field_notes from authenticated;

grant select, insert, update on table public.field_notes to authenticated;
grant all on table public.field_notes to service_role;

drop policy if exists field_notes_select on public.field_notes;
drop policy if exists field_notes_insert on public.field_notes;
drop policy if exists field_notes_update on public.field_notes;

create policy field_notes_select
  on public.field_notes
  for select
  to authenticated
  using (true);

create policy field_notes_insert
  on public.field_notes
  for insert
  to authenticated
  with check (author_user_id = (select auth.uid())::text);

create policy field_notes_update
  on public.field_notes
  for update
  to authenticated
  using (true)
  with check (true);
