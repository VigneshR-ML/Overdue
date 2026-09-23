-- 0027: complete payment-plan delivery, allocation, and workspace notification invariants.
-- Additive and safe after 0021-0026 plus dated workflow migrations.

-- A queued job needs explicit claim/sent state so cron retries cannot double-send.
alter table public.outbox_jobs add column if not exists locked_at timestamptz;
alter table public.outbox_jobs add column if not exists sent_at timestamptz;
create index if not exists outbox_claimable_idx
  on public.outbox_jobs (run_after)
  where sent_at is null and dead_lettered_at is null;

-- A proposal has its own expiry; it must not inherit an unrelated settlement
-- expiry forever.
alter table public.payment_plans add column if not exists expires_at timestamptz;
alter table public.payment_plans add column if not exists accepted_at timestamptz;
alter table public.payment_plans add column if not exists declined_at timestamptz;
create index if not exists payment_plans_expiry_idx
  on public.payment_plans (status, expires_at)
  where status = 'proposed' and expires_at is not null;

-- A provider payment may settle more than one installment. Keep the payment
-- ledger normalized and record every applied amount separately.
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  plan_installment_id uuid not null references public.plan_installments (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (payment_id, plan_installment_id)
);
create index if not exists payment_allocations_installment_idx
  on public.payment_allocations (plan_installment_id);
alter table public.payment_allocations enable row level security;
revoke all on public.payment_allocations from anon, authenticated;
grant select on public.payment_allocations to authenticated;
drop policy if exists payment_allocations_select on public.payment_allocations;
create policy payment_allocations_select on public.payment_allocations
  for select to authenticated using (public.is_workspace_member(workspace_id));

-- Notifications are addressed to people, not only workspaces. The former
-- workspace-wide key prevented the same event appearing for more than one
-- permitted recipient.
alter table public.notifications
  drop constraint if exists notifications_workspace_id_dedupe_key_key;
create unique index if not exists notifications_recipient_dedupe_uidx
  on public.notifications (recipient_member_id, dedupe_key)
  where recipient_member_id is not null;

-- Claim due jobs atomically. It is server-only: no anon/authenticated execute
-- grant, a pinned search_path, and SKIP LOCKED prevents duplicate sends.
create or replace function public.claim_due_outbox_jobs(p_limit int default 25)
returns setof public.outbox_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select id
    from public.outbox_jobs
    where sent_at is null
      and dead_lettered_at is null
      and run_after <= now()
      and (locked_at is null or locked_at < now() - interval '5 minutes')
    order by run_after asc, created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.outbox_jobs jobs
  set locked_at = now(), attempt_count = jobs.attempt_count + 1
  from candidates
  where jobs.id = candidates.id
  returning jobs.*;
end;
$$;
revoke all on function public.claim_due_outbox_jobs(int) from public;
grant execute on function public.claim_due_outbox_jobs(int) to service_role;
