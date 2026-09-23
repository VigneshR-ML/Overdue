-- Opt-in auto-plan settings and immutable one-per-request proposal audit.
create table if not exists public.payment_plan_automation_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  max_incentive_bps integer not null default 500 check (max_incentive_bps between 0 and 2000),
  updated_at timestamptz not null default now()
);

create table if not exists public.auto_payment_plan_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_plan_request_id uuid not null unique references public.payment_plan_requests(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  offer_id uuid references public.settlement_offers(id) on delete set null,
  offer_cents integer not null check (offer_cents >= 0),
  incentive_bps integer not null check (incentive_bps between 0 and 2000),
  status text not null default 'created' check (status in ('created','sent','delivery_failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index if not exists auto_payment_plan_proposals_invoice_idx
  on public.auto_payment_plan_proposals (user_id, invoice_id, created_at desc);

alter table public.payment_plan_automation_settings enable row level security;
alter table public.auto_payment_plan_proposals enable row level security;

drop policy if exists payment_plan_automation_settings_select_own on public.payment_plan_automation_settings;
create policy payment_plan_automation_settings_select_own on public.payment_plan_automation_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists auto_payment_plan_proposals_select_own on public.auto_payment_plan_proposals;
create policy auto_payment_plan_proposals_select_own on public.auto_payment_plan_proposals
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.payment_plan_automation_settings, public.auto_payment_plan_proposals from anon, authenticated;
grant select on public.payment_plan_automation_settings, public.auto_payment_plan_proposals to authenticated;
