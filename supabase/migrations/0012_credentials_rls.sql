-- Harden integration_credentials against anonymous/authenticated reads.
-- The table stores Stripe/PayPal/Xero OAuth tokens; it is only ever read or
-- written via the service-role admin client (credentials.ts), which bypasses RLS.
--
-- The original table (0002) disabled RLS and only GRANTed service_role, but
-- Supabase grants default privileges to anon/authenticated on new public-schema
-- tables, so the access tokens were readable via the public REST API. This enforces
-- RLS deny-all and revokes those grants.
alter table public.integration_credentials enable row level security;

-- No policies: the table must be touched exclusively through service_role / Vault.
-- A deny-all policy makes the intent explicit even if a future GRANT re-appears.
create policy integration_credentials_service_only
  on public.integration_credentials
  for all
  using (false)
  with check (false);

revoke all on public.integration_credentials from anon, authenticated;
revoke all on function public.create_secret, public.read_secret, public.delete_secret from anon, authenticated;