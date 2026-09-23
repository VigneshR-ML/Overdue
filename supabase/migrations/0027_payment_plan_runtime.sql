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
alter table public.payments add column if not exists reconciled_at timestamptz;
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
alter table public.notifications
  drop constraint if exists notifications_recipient_dedupe_key_key;
alter table public.notifications
  add constraint notifications_recipient_dedupe_key_key
  unique (recipient_member_id, dedupe_key);

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


-- Reconcile a confirmed ledger payment exactly once. This database transaction
-- is the single authority for invoice balances and installment allocations.
create or replace function public.reconcile_confirmed_payment(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments%rowtype;
  inv public.invoices%rowtype;
  plan public.payment_plans%rowtype;
  inst public.plan_installments%rowtype;
  remaining int;
  applied int;
  allocation int;
  installment_remaining int;
  first_installment uuid := null;
  all_plan_paid boolean := false;
  has_plan boolean := false;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment not found'; end if;
  if pay.status <> 'confirmed' then raise exception 'payment is not confirmed'; end if;
  if pay.reconciled_at is not null then
    return jsonb_build_object('already_reconciled', true, 'invoice_id', pay.invoice_id);
  end if;

  select * into inv from public.invoices where id = pay.invoice_id for update;
  if not found then raise exception 'invoice not found'; end if;
  remaining := greatest(0, inv.amount_cents - coalesce(inv.paid_cents, 0));
  applied := least(pay.amount_cents, remaining);

  select * into plan
  from public.payment_plans
  where invoice_id = pay.invoice_id
    and status in ('active', 'delinquent')
  order by created_at desc
  limit 1
  for update;

  has_plan := found;
  if has_plan and applied > 0 then
    remaining := applied;
    for inst in
      select *
      from public.plan_installments
      where payment_plan_id = plan.id
        and status in ('scheduled', 'due', 'partially_paid', 'overdue')
      order by due_date asc, sequence_no asc
      for update
    loop
      exit when remaining <= 0;
      installment_remaining := greatest(0, inst.amount_cents - coalesce(inst.paid_cents, 0));
      if installment_remaining = 0 then continue; end if;
      allocation := least(remaining, installment_remaining);
      insert into public.payment_allocations(payment_id, plan_installment_id, workspace_id, amount_cents)
        values (pay.id, inst.id, coalesce(pay.workspace_id, plan.workspace_id), allocation)
        on conflict (payment_id, plan_installment_id) do nothing;
      update public.plan_installments
      set paid_cents = coalesce(paid_cents, 0) + allocation,
          paid_at = case when coalesce(paid_cents, 0) + allocation >= amount_cents then now() else paid_at end,
          status = case
            when coalesce(paid_cents, 0) + allocation >= amount_cents then 'paid'
            else 'partially_paid'
          end
      where id = inst.id;
      if first_installment is null then first_installment := inst.id; end if;
      remaining := remaining - allocation;
    end loop;
  end if;

  update public.invoices
  set paid_cents = coalesce(paid_cents, 0) + applied,
      paid_at = case when coalesce(paid_cents, 0) + applied >= amount_cents then now() else paid_at end,
      status = case
        when coalesce(paid_cents, 0) + applied >= amount_cents then 'paid'
        else 'partially_paid'
      end,
      updated_at = now()
  where id = inv.id;

  if first_installment is not null then
    update public.payments set plan_installment_id = first_installment where id = pay.id;
  end if;

  if has_plan then
    select not exists(
      select 1 from public.plan_installments
      where payment_plan_id = plan.id and status <> 'paid'
    ) into all_plan_paid;
    if all_plan_paid then
      update public.payment_plans
      set status = 'completed', completion_source = 'final_installment_paid', updated_at = now()
      where id = plan.id and status in ('active', 'delinquent');
    end if;
  end if;

  update public.payments set reconciled_at = now() where id = pay.id;
  return jsonb_build_object(
    'invoice_id', inv.id,
    'user_id', inv.user_id,
    'workspace_id', inv.workspace_id,
    'applied_cents', applied,
    'fully_paid', coalesce(inv.paid_cents, 0) + applied >= inv.amount_cents,
    'plan_completed', all_plan_paid
  );
end;
$$;
revoke all on function public.reconcile_confirmed_payment(uuid) from public;
grant execute on function public.reconcile_confirmed_payment(uuid) to service_role;
