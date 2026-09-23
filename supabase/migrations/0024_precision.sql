-- 0024: Dispute outcome enum + counter-reason enum (review precision gaps).
-- Pre-existing base tables confirmed (not re-created here):
--   disputes (0013: id,user,invoice,category,amount,reason,status open/resolved,resolved_at)
--   runs.promise_date/note/amount (0010), runs.promise_missed (0013)
--   settlement_offers (0016 + 0021 suspended), sequences/runs (0001) = recovery_sequences/runs alias
--   payment_plan_requests (0018 + 0021 canonical enum)

alter table public.disputes add column if not exists outcome text
  check (outcome is null or outcome in ('resolved','withdrawn','credit_issued','invoice_corrected'));
alter table public.disputes add column if not exists resolved_note text;

-- Named counter reasons (replaces vague boolean reading of is_counter_proposal)
do $$ begin
  alter table public.payment_plans drop constraint if exists payment_plans_counter_reason_check;
exception when undefined_object then null; end $$;
alter table public.payment_plans add constraint payment_plans_counter_reason_check
  check (counter_reason is null or counter_reason in ('exceeds_allowed_count','final_below_minimum'));

-- Backfill legacy free-text reasons to enum values
update public.payment_plans set counter_reason = 'exceeds_allowed_count'
  where is_counter_proposal and counter_reason = 'desired_count exceeds policy';
update public.payment_plans set counter_reason = 'final_below_minimum'
  where is_counter_proposal and counter_reason like 'Counter-proposal:%';

-- manual_payment_approvals field list (introduced in 0023, restated for rigor):
--   payment_id PK->payments, created_by, confirmed_by, threshold_cents, created_at
-- No schema change; assertion only.
do $$ begin
  if to_regclass('public.manual_payment_approvals') is null then
    raise exception 'manual_payment_approvals missing — 0023 not applied';
  end if;
end $$;
