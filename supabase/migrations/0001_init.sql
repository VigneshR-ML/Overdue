-- Overdue (The Ledger) initial schema
-- Run via: supabase db push / db reset, or paste into Supabase SQL editor.

-- Profiles mirror auth.users
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Subscriptions (Paddle Billing)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paddle_subscription_id text unique,
  paddle_customer_id text,
  plan text not null default 'free' check (plan in ('free','pro')),
  status text not null default 'active' check (status in ('active','trialing','past_due','cancelled')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create index subscriptions_user_idx on public.subscriptions(user_id);

-- Integration connections (tokens stored in Vault, ids referenced here)
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe','paypal','xero','csv')),
  status text not null default 'connected' check (status in ('connected','error')),
  display_name text,
  last_synced_at timestamptz,
  connected_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.integrations enable row level security;

create index integrations_user_idx on public.integrations(user_id);

-- Clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  billing_email text,
  payment_history_score int check (payment_history_score between 0 and 100),
  avg_payment_days int,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create index clients_user_idx on public.clients(user_id);

-- Invoices (unified across providers)
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  provider text not null check (provider in ('stripe','paypal','xero','manual')),
  provider_id text,
  number text,
  status text not null default 'sent' check (status in ('pending','sent','paid','partially_paid','overdue')),
  amount_cents bigint not null default 0,
  paid_cents bigint not null default 0,
  currency text not null default 'USD',
  issue_date date,
  due_date date,
  paid_at timestamptz,
  line_item_summary text,
  created_at timestamptz not null default now(),
  unique (user_id, provider, provider_id)
);

alter table public.invoices enable row level security;

create index invoices_user_idx on public.invoices(user_id);
create index invoices_due_idx on public.invoices(user_id, due_date);

-- Sequences (escalation ladders). Steps stored JSONB for atomic editor saves.
create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  is_default boolean not null default false,
  is_template boolean not null default false,
  steps jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sequences enable row level security;
-- Templates are public rows owned by system; RLS permits read via helper policy.

create index sequences_user_idx on public.sequences(user_id);

-- Runs: one active run per invoice per sequence
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  current_step int not null default 0,
  status text not null default 'queued' check (status in ('queued','sent','completed','paused','failed')),
  next_run_at timestamptz,
  last_sent_at timestamptz,
  messages_sent int not null default 0,
  created_at timestamptz not null default now(),
  unique (sequence_id, invoice_id)
);

alter table public.runs enable row level security;

create index runs_dispatch_idx on public.runs(status, next_run_at);
create index runs_user_idx on public.runs(user_id);

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text not null,
  step int not null,
  tone text not null check (tone in ('gentle','nudge','firm','final')),
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  replied boolean not null default false,
  resend_message_id text
);

alter table public.messages enable row level security;

create index messages_user_idx on public.messages(user_id);

-- Webhook idempotency ledger
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.webhook_events enable row level security;

-- ---------------------------------------------------------------------------
-- Row Level Security policies
-- ---------------------------------------------------------------------------

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "subs_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);
create policy "subs_all_own" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "integrations_select_own" on public.integrations
  for select using (auth.uid() = user_id);
create policy "integrations_all_own" on public.integrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "clients_select_own" on public.clients
  for select using (auth.uid() = user_id);
create policy "clients_all_own" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "invoices_select_own" on public.invoices
  for select using (auth.uid() = user_id);
create policy "invoices_all_own" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Sequences: users see own; templates (is_template) readable by everyone
create policy "sequences_select_own_or_template" on public.sequences
  for select using (is_template or auth.uid() = user_id);
create policy "sequences_all_own" on public.sequences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "runs_select_own" on public.runs
  for select using (auth.uid() = user_id);
create policy "runs_all_own" on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "messages_select_own" on public.messages
  for select using (auth.uid() = user_id);
create policy "messages_all_own" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "webhooks_select_own" on public.webhook_events
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

-- Default ladder sequences, seeded for every new user
create or replace function public.seed_default_sequences()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.sequences (user_id, name, description, is_default, steps) values
  (new.id, 'Standard Ladder', 'The default: gentle to final, one day of silence between each touch.', true,
   '[
     {"step_order":1,"delay_days":1,"tone":"gentle","ai_enabled":true,"subject_template":"Just checking in on invoice {invoice_number}","body_template":"Hi {client_name},\n\nQuick note that invoice {invoice_number} for {amount} was due on {due_date} — no rush, but wanted to make sure it didn''t slip through.\n\nWhenever you''re able, great. Happy to answer anything.\n\nBest,\n{sender_name}"},
     {"step_order":2,"delay_days":7,"tone":"nudge","ai_enabled":true,"subject_template":"Friendly reminder: invoice {invoice_number}","body_template":"Hi {client_name},\n\nJust a friendly ping on invoice {invoice_number} ({amount}), due {due_date}.\n\nIf anything looks off, reply here and I''ll sort it out today.\n\nThanks,\n{sender_name}"},
     {"step_order":3,"delay_days":7,"tone":"firm","ai_enabled":true,"subject_template":"Invoice {invoice_number} — can you confirm receipt?","body_template":"Hi {client_name},\n\nInvoice {invoice_number} for {amount} is now {days_overdue} days past due. I need to keep my own books clean, so could you confirm a payment date?\n\nIf the invoice is disputed or needs changes, tell me now and we''ll fix it.\n\nBest,\n{sender_name}"},
     {"step_order":4,"delay_days":7,"tone":"final","ai_enabled":true,"subject_template":"Final notice: invoice {invoice_number}","body_template":"Hi {client_name},\n\nThis is the final reminder for invoice {invoice_number} ({amount}), now {days_overdue} days overdue.\n\nUnless payment is scheduled within 5 days, I''ll need to pause work and hand this to a collections process. I''d rather not — please let me know the plan.\n\nThanks,\n{sender_name}"}
   ]'::jsonb)
  on conflict do nothing;

  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created_seed') then
    create trigger on_auth_user_created_seed
      after insert on auth.users
      for each row execute function public.seed_default_sequences();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- System template sequences (public, id=00000000-0000-4000-8000-000000000001)
-- ---------------------------------------------------------------------------
insert into public.sequences (id, user_id, name, description, is_template, steps) values
('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000000', 'Standard Ladder', 'Gentle to final. The default most freelancers start with.', true,
 '[
   {"step_order":1,"delay_days":1,"tone":"gentle","ai_enabled":true,"subject_template":"Just checking in on invoice {invoice_number}","body_template":"Hi {client_name},\n\nQuick note that invoice {invoice_number} for {amount} was due on {due_date} — no rush, but wanted to make sure it didn''t slip through.\n\nBest,\n{sender_name}"},
   {"step_order":2,"delay_days":7,"tone":"nudge","ai_enabled":true,"subject_template":"Friendly reminder: invoice {invoice_number}","body_template":"Hi {client_name},\n\nFriendly ping on invoice {invoice_number} ({amount}), due {due_date}. If anything looks off, reply here and I''ll fix it today.\n\nThanks,\n{sender_name}"},
   {"step_order":3,"delay_days":7,"tone":"firm","ai_enabled":true,"subject_template":"Invoice {invoice_number} — could you confirm receipt?","body_template":"Hi {client_name},\n\nInvoice {invoice_number} for {amount} is now {days_overdue} days past due. Could you confirm a payment date? If it''s in dispute, tell me now and we''ll fix it.\n\nBest,\n{sender_name}"},
   {"step_order":4,"delay_days":7,"tone":"final","ai_enabled":true,"subject_template":"Final notice: invoice {invoice_number}","body_template":"Hi {client_name},\n\nFinal reminder for invoice {invoice_number} ({amount}), now {days_overdue} days overdue. Unless payment is scheduled within 5 days I''ll pause work and escalate.\n\nThanks,\n{sender_name}"}
 ]'::jsonb)
on conflict do nothing;

insert into public.sequences (id, user_id, name, description, is_template, steps) values
('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000000', 'Soft Touch', 'Long, patient cadence for retainers you trust.', true,
 '[
   {"step_order":1,"delay_days":7,"tone":"gentle","ai_enabled":true,"subject_template":"Invoice {invoice_number} — whenever works","body_template":"Hi {client_name},\n\nJust a light note that invoice {invoice_number} ({amount}) went out on {issue_date}. No hurry at all — flagging it so it''s on your radar.\n\nBest,\n{sender_name}"},
   {"step_order":2,"delay_days":14,"tone":"nudge","ai_enabled":true,"subject_template":"Friendly check-in on {invoice_number}","body_template":"Hi {client_name},\n\nLast quiet ping on invoice {invoice_number} ({amount}). If a different payment date works better, let me know and we''ll set it.\n\nThanks,\n{sender_name}"},
   {"step_order":3,"delay_days":14,"tone":"firm","ai_enabled":true,"subject_template":"Invoice {invoice_number} — payment date?","body_template":"Hi {client_name},\n\nInvoice {invoice_number} ({amount}) is {days_overdue} days overdue. Can you confirm when we''ll see it? Open to a schedule if that helps.\n\nBest,\n{sender_name}"}
 ]'::jsonb)
on conflict do nothing;

insert into public.sequences (id, user_id, name, description, is_template, steps) values
('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000000', 'Fast Cash', 'Tight three-step sprint for clients who tend to pay late.', true,
 '[
   {"step_order":1,"delay_days":3,"tone":"nudge","ai_enabled":true,"subject_template":"Quick heads-up: invoice {invoice_number}","body_template":"Hi {client_name},\n\nInvoice {invoice_number} for {amount} was due {days_overdue} days ago. Just flagging it so it stays front of mind.\n\nThanks,\n{sender_name}"},
   {"step_order":2,"delay_days":4,"tone":"firm","ai_enabled":true,"subject_template":"Payment needed on {invoice_number}","body_template":"Hi {client_name},\n\nInvoice {invoice_number} ({amount}) is now {days_overdue} days past due. Please reply with a payment date today so we can keep things moving.\n\nBest,\n{sender_name}"},
   {"step_order":3,"delay_days":5,"tone":"final","ai_enabled":true,"subject_template":"Final notice — action required on {invoice_number}","body_template":"Hi {client_name},\n\nInvoice {invoice_number} ({amount}) is {days_overdue} days overdue. Unless payment is received within 3 days, work will pause until it''s settled.\n\nThanks,\n{sender_name}"}
 ]'::jsonb)
on conflict do nothing;