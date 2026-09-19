-- Website → Procore bot wake queue. Greg's fleet polls `queued` rows
-- (or receives the same payload on PROCORE_BOT_WAKE_URL).
-- Structured request: gcfieldlog.procore_bot_refresh.v1
--
-- Does NOT create or alter:
--   public.procore_connections (including notify_email)
--   public.invite_tokens, public.room_packs, public.rfis
--   share_folders / pinned_sheets / markup_overlays
--
-- Website enqueue uses SUPABASE_SERVICE_ROLE_KEY. Anon has no access.
-- The bot / ops claims with the service role.

create table if not exists public.procore_bot_requests (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  project_name text not null,
  room text not null,
  request_id text not null,
  reason text,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint procore_bot_requests_bot_id_not_blank
    check (char_length(trim(bot_id)) > 0),
  constraint procore_bot_requests_project_name_not_blank
    check (char_length(trim(project_name)) > 0),
  constraint procore_bot_requests_request_id_not_blank
    check (char_length(trim(request_id)) > 0),
  constraint procore_bot_requests_status_check
    check (status in ('queued', 'claimed', 'done', 'error'))
);

create index if not exists procore_bot_requests_status_created_idx
  on public.procore_bot_requests (status, created_at);

create index if not exists procore_bot_requests_request_id_idx
  on public.procore_bot_requests (request_id);

alter table public.procore_bot_requests enable row level security;

revoke all on table public.procore_bot_requests from anon;
revoke all on table public.procore_bot_requests from authenticated;

grant all on table public.procore_bot_requests to service_role;
