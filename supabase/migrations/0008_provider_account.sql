-- 0008: map provider accounts to users for real-time paid webhooks.
-- Xero events carry tenantId and Stripe events carry the connected account id,
-- neither of which is our user_id. This column lets /api/webhooks/xero resolve
-- the owner in one indexed query (works whether credentials live in Vault or
-- the legacy plaintext column). Safe to re-run.
alter table public.integrations
  add column if not exists provider_account_id text;

create index if not exists idx_integrations_provider_account
  on public.integrations (provider, provider_account_id);

-- Backfill rows connected before this migration from plaintext payloads.
-- (Vault-backed rows have payload NULL; those users re-resolve on next sync.)
update public.integrations i
   set provider_account_id = coalesce(
     c.payload->>'tenant_id',
     c.payload->>'stripe_user_id'
   )
  from public.integration_credentials c
 where c.user_id = i.user_id
   and c.provider = i.provider
   and i.provider_account_id is null
   and c.payload is not null;
