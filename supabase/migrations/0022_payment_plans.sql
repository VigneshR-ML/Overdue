-- 0022: Real installment ledger — payment_plans, installments, payments, checkout, settings.
-- Implements: deterministic algorithm homes (policy_snapshot, proposal_version),
-- completion_source/cancellation_reason split, paid-from-ledger rule.

create table if not exists public.payment_plan_settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  version int not null default 1,
  min_installment_cents int not null default 10000,
  max_installments int not null default 12 check (max_installments >= 1),
  max_duration_days int not null default 365 check (max_duration_days >= 30),
  max_incentive_bps int not null default 500 check (max_incentive_bps >= 0 and max_incentive_bps <= 2000),
  review_timeout_hours int not null default 72,
  proposal_expiry_days int not null default 7,
  missed_before_delinquent int not null default 2,
  manual_dual_control_threshold_cents int not null default 50000,
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  request_id uuid references public.payment_plan_requests (id) on delete set null,
  total_cents int not null check (total_cents > 0),
  currency text not null default 'USD',
  installment_count int not null check (installment_count >= 1),
  frequency text not null check (frequency in ('weekly','biweekly','monthly')),
  starts_on date not null,
  anchor_day int check (anchor_day is null or (anchor_day >= 1 and anchor_day <= 31)),
  status text not null default 'proposed'
    check (status in ('proposed','active','delinquent','completed','cancelled')),
  proposal_version int not null default 1,
  supersedes_plan_id uuid references public.payment_plans (id) on delete set null,
  policy_snapshot jsonb not null default '{}'::jsonb,
  completion_source text check (completion_source is null or completion_source in ('final_installment_paid','direct_invoice_payment')),
  cancellation_reason text check (cancellation_reason is null or cancellation_reason in ('owner_cancelled','debtor_declined','default_after_missed_installments','replaced','invoice_paid_directly')),
  is_counter_proposal boolean not null default false,
  counter_reason text,
  exceeds_debtor_preference boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_plans_invoice_idx on public.payment_plans (invoice_id, status);
create index if not exists payment_plans_request_idx on public.payment_plans (request_id);

create table if not exists public.plan_installments (
  id uuid primary key default gen_random_uuid(),
  payment_plan_id uuid not null references public.payment_plans (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  sequence_no int not null check (sequence_no >= 1),
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'USD',
  due_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','due','partially_paid','paid','overdue','waived','cancelled')),
  paid_cents int not null default 0 check (paid_cents >= 0),
  paid_at timestamptz,
  unique (payment_plan_id, sequence_no)
);
create index if not exists plan_installments_plan_idx on public.plan_installments (payment_plan_id, due_date);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  plan_installment_id uuid references public.plan_installments (id) on delete set null,
  checkout_attempt_id uuid,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'USD',
  source text not null check (source in ('stripe','paypal','xero_sync','manual','bank_transfer')),
  status text not null default 'confirmed' check (status in ('pending','confirmed','failed','refunded')),
  provider_event_id text,
  recorded_by_member_id uuid,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source, provider_event_id)
);
create index if not exists payments_invoice_idx on public.payments (invoice_id, status);
create index if not exists payments_installment_idx on public.payments (plan_installment_id);

create table if not exists public.checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  plan_installment_id uuid references public.plan_installments (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete cascade,
  provider text not null check (provider in ('stripe','paypal','manual')),
  provider_session_id text,
  url text,
  status text not null default 'open' check (status in ('open','completed','expired','cancelled')),
  expires_at timestamptz,
  regenerated_from_id uuid references public.checkout_attempts (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.payments add constraint payments_checkout_fk
  foreign key (checkout_attempt_id) references public.checkout_attempts (id) on delete set null not valid;

-- Rate-limit helper: one open request per invoice enforced in app + partial index
create unique index if not exists payment_plan_requests_one_open_per_invoice
  on public.payment_plan_requests (invoice_id)
  where status in ('submitted','under_review','open');

alter table public.payment_plans enable row level security;
alter table public.plan_installments enable row level security;
alter table public.payments enable row level security;
alter table public.checkout_attempts enable row level security;
alter table public.payment_plan_settings enable row level security;
revoke all on table public.payment_plans from anon, authenticated;
revoke all on table public.plan_installments from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.checkout_attempts from anon, authenticated;
revoke all on table public.payment_plan_settings from anon, authenticated;
grant select on table public.payment_plans to authenticated;
grant select on table public.plan_installments to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.checkout_attempts to authenticated;
grant select on table public.payment_plan_settings to authenticated;
