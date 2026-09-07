-- Server-only credential store for outbound integrations (Stripe/PayPal/Xero).
-- RLS intentionally OFF: read/write exclusively via service-role (webhooks/cron/routes).
-- Production hardening: migrate to Supabase Vault (`select * from vault.create_secret(...)`) —
-- values here are stored at rest; add column-level encryption before real deployments.

create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe','paypal','xero')),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.integration_credentials disable row level security;

create index integration_credentials_user_idx on public.integration_credentials(user_id);

-- Convenient helpers for authenticated users (optional; keep them minimal).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.integration_credentials to service_role;