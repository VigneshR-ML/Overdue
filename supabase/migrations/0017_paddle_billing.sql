-- 0017: Add Paddle Billing as primary merchant of record (Dodo kept as fallback).
--
-- 1. Add paddle_* identifier columns (Paddle ids are text).
-- 2. Add billing_provider discriminator ('paddle' | 'dodo'), defaulting existing
--    rows to 'dodo' so current subscribers keep working untouched.
-- Safe on empty tables; on existing rows, paddle ids start NULL and the
-- provider stays 'dodo' until a Paddle event or reconcile flips it.

-- Paddle Billing identifiers (subscription/customer ids are text).
alter table public.subscriptions
  add column if not exists paddle_subscription_id text unique,
  add column if not exists paddle_customer_id text;

-- Billing provider discriminator: which MoR owns this row.
alter table public.subscriptions
  add column if not exists billing_provider text default 'dodo'
  check (billing_provider in ('dodo', 'paddle'));

create index if not exists subscriptions_paddle_customer_idx
  on public.subscriptions (paddle_customer_id);
