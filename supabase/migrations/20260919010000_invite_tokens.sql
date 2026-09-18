-- Crew invite links. NEW table — do not extend trial_link_tokens.
-- Role is baked into the token at mint time: viewer | full.
-- `full` maps to the existing stub session role `puller` (normal dashboard).
-- Single-use: used_at is set on redeem. Expired or used tokens are rejected.
--
-- Does NOT create or alter:
--   public.trial_link_tokens
--   public.procore_connections (including notify_email — other PR)
--   public.room_packs, public.rfis, public.billing_customers
--   public.job_sites / workers / time_punches
--   share_folders / pinned_sheets / markup_overlays
--
-- created_by is text to match stub sessions (`stub:` + sha256) and later
-- auth.uid()::text. Website mint/redeem use SUPABASE_SERVICE_ROLE_KEY
-- (service role bypasses RLS). Anon has no access.

create table if not exists public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  token text unique not null,
  role text not null,
  created_by text not null,
  invitee_email text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invite_tokens_token_not_blank check (char_length(trim(token)) > 0),
  constraint invite_tokens_role_check check (role in ('viewer', 'full')),
  constraint invite_tokens_created_by_not_blank check (char_length(trim(created_by)) > 0),
  constraint invite_tokens_invitee_email_normalized check (
    invitee_email is null
    or invitee_email = lower(trim(invitee_email))
  )
);

create unique index if not exists invite_tokens_token_idx
  on public.invite_tokens (token);

create index if not exists invite_tokens_created_by_idx
  on public.invite_tokens (created_by);

create index if not exists invite_tokens_invitee_email_idx
  on public.invite_tokens (invitee_email);

create index if not exists invite_tokens_expires_at_idx
  on public.invite_tokens (expires_at);

alter table public.invite_tokens enable row level security;

revoke all on table public.invite_tokens from anon;
revoke all on table public.invite_tokens from authenticated;

grant select, insert on table public.invite_tokens to authenticated;
grant all on table public.invite_tokens to service_role;

drop policy if exists invite_tokens_creator_select on public.invite_tokens;
drop policy if exists invite_tokens_creator_insert on public.invite_tokens;

create policy invite_tokens_creator_select
  on public.invite_tokens
  for select
  to authenticated
  using (created_by = (select auth.uid())::text);

create policy invite_tokens_creator_insert
  on public.invite_tokens
  for insert
  to authenticated
  with check (created_by = (select auth.uid())::text);
