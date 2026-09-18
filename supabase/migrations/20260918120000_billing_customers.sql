-- Stripe subscription customers. Service role writes from the webhook.
-- Anon has no access — never expose billing rows via the anon key.

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  email text,
  stripe_customer_id text not null unique,
  stripe_subscription_id text,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'canceled', 'past_due')),
  trial_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_customers_email_idx
  on public.billing_customers (lower(email));

alter table public.billing_customers enable row level security;

revoke all on table public.billing_customers from anon;
revoke all on table public.billing_customers from authenticated;

grant select on table public.billing_customers to authenticated;
grant all on table public.billing_customers to service_role;

drop policy if exists users_read_own_billing_customer on public.billing_customers;

create policy users_read_own_billing_customer
  on public.billing_customers
  for select
  to authenticated
  using (
    lower(coalesce(email, '')) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );
