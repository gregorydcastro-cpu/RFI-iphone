-- Per-user Procore OAuth tokens. Service role writes; users may only
-- SELECT their own row once real Supabase Auth is in place. Anon has
-- no access — never expose access_token / refresh_token via the anon key.

create table if not exists public.procore_connections (
  user_id text primary key,
  email text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  -- Last-known from GET /me only. Live calls resolve company id per project.
  company_id text,
  procore_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists procore_connections_email_idx
  on public.procore_connections (lower(email));

alter table public.procore_connections enable row level security;

revoke all on table public.procore_connections from anon;
revoke all on table public.procore_connections from authenticated;

grant select on table public.procore_connections to authenticated;
grant all on table public.procore_connections to service_role;

drop policy if exists users_read_own_procore_connection on public.procore_connections;

create policy users_read_own_procore_connection
  on public.procore_connections
  for select
  to authenticated
  using (
    user_id = (select auth.uid())::text
    or lower(coalesce(email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
