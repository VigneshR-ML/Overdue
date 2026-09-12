-- 0013: reply intelligence + disputes.
--
-- Turns inbound client replies into structured signal: every reply is
-- classified (paid / promise / dispute / question / angry / …) and stored in
-- reply_intel, disputes get their own first-class row (they are what should
-- pause a ladder before the wrong email goes out), and a few denormalised
-- columns land on runs so the dispatcher can act without extra joins.
--
-- Structured data stays the source of truth; classifications only route.
-- Safe to re-run: every statement is IF NOT EXISTS / guarded.

-- ---------------------------------------------------------------------------
-- reply_intel: one row per classified inbound reply.
-- ---------------------------------------------------------------------------
create table if not exists public.reply_intel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete cascade,
  classification text not null check (classification in (
    'paid','promise','dispute','question','payment_plan',
    'already_paid','wrong_recipient','angry','needs_human','other'
  )),
  confidence int not null default 0 check (confidence between 0 and 100),
  source text not null default 'heuristic' check (source in ('heuristic','llm')),
  raw_text text,
  extracted_date date,
  amount_cents int,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.reply_intel enable row level security;

create index if not exists reply_intel_user_idx on public.reply_intel(user_id);
create index if not exists reply_intel_invoice_idx on public.reply_intel(invoice_id);
create index if not exists reply_intel_run_idx on public.reply_intel(run_id);

drop policy if exists "reply_intel_select_own" on public.reply_intel;
create policy "reply_intel_select_own" on public.reply_intel
  for select using (auth.uid() = user_id);
drop policy if exists "reply_intel_all_own" on public.reply_intel;
create policy "reply_intel_all_own" on public.reply_intel
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- disputes: an open dispute blocks automated chasing until resolved.
-- ---------------------------------------------------------------------------
create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  category text,
  amount_cents int,
  reason text,
  status text not null default 'open' check (status in ('open','resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.disputes enable row level security;

create index if not exists disputes_user_idx on public.disputes(user_id);
create index if not exists disputes_invoice_idx on public.disputes(invoice_id);
create index if not exists disputes_open_idx on public.disputes(user_id, status);

drop policy if exists "disputes_select_own" on public.disputes;
create policy "disputes_select_own" on public.disputes
  for select using (auth.uid() = user_id);
drop policy if exists "disputes_all_own" on public.disputes;
create policy "disputes_all_own" on public.disputes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- runs: reply routing + automation safety denormalised for the dispatcher.
-- ---------------------------------------------------------------------------
alter table public.runs
  add column if not exists reply_classification text,
  add column if not exists last_reply_at timestamptz,
  add column if not exists promise_missed boolean not null default false,
  add column if not exists automation_confidence int;
