-- 0014: Paddle -> Lemon Squeezy billing cutover (no paying users yet: hard cutover).
--
-- 1. Widen subscriptions.status to the Lemon Squeezy lifecycle
--    (active, on_trial, paused, past_due, cancelled, expired, unpaid + legacy trialing).
-- 2. Replace paddle_* columns with lemon_* columns.
-- Safe on empty tables; on stray dev rows, lemon ids start NULL (free plan).

-- Drop the legacy status CHECK (auto-named in 0001) then add the Lemon set.
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
  check (status in ('active','trialing','on_trial','paused','past_due','cancelled','expired','unpaid'));

-- Lemon Squeezy identifiers (subscription id is numeric-as-text, e.g. "123456").
alter table public.subscriptions
  add column if not exists lemon_subscription_id text unique,
  add column if not exists lemon_customer_id text,
  add column if not exists variant_id text;

-- Drop Paddle columns (hard cutover, no paying users to migrate).
alter table public.subscriptions drop column if exists paddle_subscription_id;
alter table public.subscriptions drop column if exists paddle_customer_id;

create index if not exists subscriptions_lemon_customer_idx
  on public.subscriptions (lemon_customer_id);
