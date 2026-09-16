-- 0016: Smart Settlement offers + event ledger.
--
-- Owner approves an expiring settlement (discount or late-fee waiver); the
-- debtor resolves via a signed token link (no login). Payment itself still
-- moves over the invoice's existing payment_url / provider webhook — an
-- accepted offer is a tracked commitment, not a charge. Safe to re-run.

create table if not exists public.settlement_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  outstanding_cents int not null check (outstanding_cents > 0),
  offer_cents int not null check (offer_cents > 0),
  incentive_cents int not null default 0 check (incentive_cents >= 0),
  basis text not null default 'discount' check (basis in ('discount', 'fee_waiver')),
  -- Merchant guardrails captured at approval time.
  min_acceptable_cents int null,
  max_incentive_bps int null,
  fee_basis_confirmed boolean not null default false,
  expires_at timestamptz not null,
  status text not null default 'approved'
    check (status in ('approved', 'sent', 'accepted', 'expired', 'paid', 'cancelled')),
  -- Snapshot of the engine recommendation for audit + learning.
  recommend_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlement_offer_sane check (offer_cents <= outstanding_cents)
);

create index if not exists settlement_offers_user_idx
  on public.settlement_offers (user_id);
create index if not exists settlement_offers_invoice_idx
  on public.settlement_offers (invoice_id);
create index if not exists settlement_offers_status_idx
  on public.settlement_offers (status)
  where status in ('approved', 'sent', 'accepted');

create table if not exists public.settlement_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.settlement_offers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null
    check (event in ('recommended', 'approved', 'sent', 'viewed', 'accepted', 'promise', 'plan_request', 'dispute', 'expired', 'paid', 'cancelled')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists settlement_events_offer_idx
  on public.settlement_events (offer_id);

alter table public.settlement_offers enable row level security;
alter table public.settlement_events enable row level security;

drop policy if exists settlements_select_own on public.settlement_offers;
create policy settlements_select_own on public.settlement_offers
  for select using (auth.uid() = user_id);
drop policy if exists settlements_all_own on public.settlement_offers;
create policy settlements_all_own on public.settlement_offers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists settlement_events_select_own on public.settlement_events;
create policy settlement_events_select_own on public.settlement_events
  for select using (auth.uid() = user_id);
drop policy if exists settlement_events_all_own on public.settlement_events;
create policy settlement_events_all_own on public.settlement_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.settlement_offers from anon;
revoke all on public.settlement_events from anon;
