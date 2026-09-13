-- 0015: Lemon Squeezy -> Dodo Payments billing cutover (no paying users yet: hard cutover).
--
-- 1. Re-widen subscriptions.status to the Dodo lifecycle
--    (active, on_hold, paused, past_due, cancelled, failed, expired).
-- 2. Replace lemon_* columns with dodo_* columns (dodo ids are ulid-style text).
-- Safe on empty tables; on stray dev rows, dodo ids start NULL (free plan).

-- Drop the existing status CHECK (auto-named or named in 0014) then add the Dodo set.
do $$ declare r record; begin
  for r in select oid, conname from pg_constraint
    where conrelid = 'public.subscriptions'::regclass and contype = 'c'
  loop
    if pg_get_constraintdef(r.oid) ilike '%status%' then
      execute format('alter table public.subscriptions drop constraint %I', r.conname);
    end if;
  end loop;
end $$;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in ('active','on_hold','paused','past_due','cancelled','failed','expired'));

-- Dodo Payments identifiers (subscription/customer ids are ulid-style text).
alter table public.subscriptions
  add column if not exists dodo_subscription_id text unique,
  add column if not exists dodo_customer_id text,
  add column if not exists product_id text;

-- Drop Lemon columns (hard cutover, no paying users to migrate).
alter table public.subscriptions drop column if exists lemon_subscription_id;
alter table public.subscriptions drop column if exists lemon_customer_id;
alter table public.subscriptions drop column if exists variant_id;

create index if not exists subscriptions_dodo_customer_idx
  on public.subscriptions (dodo_customer_id);