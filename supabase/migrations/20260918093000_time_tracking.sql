-- Maple Point Medical Office time tracking (geofence + crew punches).
-- Fictional demo job only. Never Danoff / Brown / Rossi / real customer names.
-- Live jobs load lat/lng/radius_m from this job_sites row (config), not a name map.
-- Stub-session writes need SUPABASE_SERVICE_ROLE_KEY (same rule as rfis).
-- Local demo does not need this table — lib/timeStore.ts seeds memory.

create table if not exists public.job_sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text,
  lat double precision not null,
  lng double precision not null,
  radius_m integer not null default 300 check (radius_m > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  job_site_id uuid not null references public.job_sites (id) on delete cascade,
  name text not null,
  role text not null default 'laborer',
  email text,
  pin_stub text,
  created_at timestamptz not null default now(),
  constraint workers_role_check
    check (role in ('foreman', 'journeyman', 'apprentice', 'electrician', 'laborer'))
);

create table if not exists public.time_punches (
  id uuid primary key default gen_random_uuid(),
  job_site_id uuid not null references public.job_sites (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  punch_type text not null,
  punched_at timestamptz not null,
  lat double precision,
  lng double precision,
  accuracy_m double precision,
  distance_m double precision,
  geofence_ok boolean not null default false,
  edited_by_foreman boolean not null default false,
  edit_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_punches_type_check check (punch_type in ('in', 'out'))
);

create index if not exists workers_job_site_id_idx on public.workers (job_site_id);
create index if not exists time_punches_job_site_id_idx on public.time_punches (job_site_id);
create index if not exists time_punches_worker_id_idx on public.time_punches (worker_id);
create index if not exists time_punches_punched_at_idx on public.time_punches (punched_at);

alter table public.job_sites enable row level security;
alter table public.workers enable row level security;
alter table public.time_punches enable row level security;

revoke all on table public.job_sites from anon;
revoke all on table public.workers from anon;
revoke all on table public.time_punches from anon;
revoke all on table public.job_sites from authenticated;
revoke all on table public.workers from authenticated;
revoke all on table public.time_punches from authenticated;

grant select on table public.job_sites to authenticated;
grant select on table public.workers to authenticated;
grant select, insert, update on table public.time_punches to authenticated;
grant all on table public.job_sites to service_role;
grant all on table public.workers to service_role;
grant all on table public.time_punches to service_role;

drop policy if exists job_sites_select_authenticated on public.job_sites;
drop policy if exists workers_select_authenticated on public.workers;
drop policy if exists time_punches_select_authenticated on public.time_punches;
drop policy if exists time_punches_insert_authenticated on public.time_punches;
drop policy if exists time_punches_update_authenticated on public.time_punches;

create policy job_sites_select_authenticated
  on public.job_sites for select to authenticated using (true);

create policy workers_select_authenticated
  on public.workers for select to authenticated using (true);

create policy time_punches_select_authenticated
  on public.time_punches for select to authenticated using (true);

-- Real auth later. Stub sessions use service role, not these policies.
create policy time_punches_insert_authenticated
  on public.time_punches for insert to authenticated with check (true);

create policy time_punches_update_authenticated
  on public.time_punches for update to authenticated using (true) with check (true);

insert into public.job_sites (id, slug, name, city, lat, lng, radius_m)
values (
  '00000000-0000-4000-8000-000000000001',
  'maple-point',
  'Maple Point Medical Office',
  'Cedar Falls',
  42.5349,
  -92.4450,
  300
)
on conflict (id) do nothing;

insert into public.workers (id, job_site_id, name, role, email, pin_stub)
values
  (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    'Pat Nguyen',
    'foreman',
    'pat.nguyen@crew.example',
    '2468'
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000001',
    'Alex Rivera',
    'journeyman',
    'alex.rivera@crew.example',
    '1041'
  ),
  (
    '00000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000001',
    'Jordan Hale',
    'apprentice',
    'jordan.hale@crew.example',
    '3302'
  ),
  (
    '00000000-0000-4000-8000-000000000014',
    '00000000-0000-4000-8000-000000000001',
    'Sam Ortiz',
    'electrician',
    'sam.ortiz@crew.example',
    '5519'
  ),
  (
    '00000000-0000-4000-8000-000000000015',
    '00000000-0000-4000-8000-000000000001',
    'Casey Brooks',
    'laborer',
    'casey.brooks@crew.example',
    '7780'
  ),
  (
    '00000000-0000-4000-8000-000000000016',
    '00000000-0000-4000-8000-000000000001',
    'Riley Chen',
    'journeyman',
    'riley.chen@crew.example',
    '8821'
  )
on conflict (id) do nothing;

-- Sample week Mon 14 Sep 2026 – Fri 18 Sep 2026 (America/Chicago).
insert into public.time_punches (
  job_site_id,
  worker_id,
  punch_type,
  punched_at,
  lat,
  lng,
  accuracy_m,
  distance_m,
  geofence_ok
)
select
  '00000000-0000-4000-8000-000000000001',
  w.id,
  p.punch_type,
  ((d.day::date + s.tod)::timestamp) at time zone 'America/Chicago',
  42.5349,
  -92.4450,
  12,
  18,
  true
from (
  values
    ('00000000-0000-4000-8000-000000000011'::uuid),
    ('00000000-0000-4000-8000-000000000012'::uuid),
    ('00000000-0000-4000-8000-000000000013'::uuid),
    ('00000000-0000-4000-8000-000000000014'::uuid),
    ('00000000-0000-4000-8000-000000000015'::uuid),
    ('00000000-0000-4000-8000-000000000016'::uuid)
) as w(id)
cross join generate_series(date '2026-09-14', date '2026-09-18', interval '1 day') as d(day)
cross join (values ('in'::text), ('out'::text)) as p(punch_type)
cross join lateral (
  select case
    when w.id = '00000000-0000-4000-8000-000000000014' and p.punch_type = 'in'
      then time '06:30'
    when w.id = '00000000-0000-4000-8000-000000000014' and p.punch_type = 'out'
      then time '14:30'
    when w.id = '00000000-0000-4000-8000-000000000012'
      and p.punch_type = 'out'
      and d.day::date = date '2026-09-17'
      then time '17:00'
    when w.id = '00000000-0000-4000-8000-000000000016'
      and p.punch_type = 'out'
      and d.day::date = date '2026-09-15'
      then time '16:30'
    when p.punch_type = 'in' then time '07:00'
    else time '15:00'
  end as tod
) as s
where not (
  w.id = '00000000-0000-4000-8000-000000000015'
  and d.day::date = date '2026-09-16'
)
and not (
  w.id = '00000000-0000-4000-8000-000000000013'
  and d.day::date = date '2026-09-18'
)
and not (
  -- Alex Rivera Friday still on the clock
  w.id = '00000000-0000-4000-8000-000000000012'
  and p.punch_type = 'out'
  and d.day::date = date '2026-09-18'
)
and not exists (
  select 1
  from public.time_punches existing
  where existing.worker_id = w.id
    and existing.punch_type = p.punch_type
    and existing.punched_at = ((d.day::date + s.tod)::timestamp) at time zone 'America/Chicago'
);
