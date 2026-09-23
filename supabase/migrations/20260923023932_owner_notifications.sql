-- Owner-facing workflow notifications and a settlement-specific checkout URL.
-- Browser clients can only read their own notifications; all writes are made
-- by the server after a validated workflow transition.

alter table public.settlement_offers
  add column if not exists settlement_payment_url text;

create table if not exists public.owner_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('settlement_accepted', 'payment_promise', 'payment_plan', 'dispute', 'invoice_paid', 'reply_received', 'payment_link_needed')),
  title text not null,
  body text not null,
  href text null,
  dedupe_key text not null,
  meta jsonb not null default '{}'::jsonb,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists owner_notifications_unread_idx
  on public.owner_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.owner_notifications enable row level security;
drop policy if exists owner_notifications_select_own on public.owner_notifications;
create policy owner_notifications_select_own on public.owner_notifications
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.owner_notifications from anon, authenticated;
grant select on public.owner_notifications to authenticated;
