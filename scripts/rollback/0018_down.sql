-- 0018_down: reverse 0018_hardening_fixes.sql.
-- EMERGENCY ROLLBACK ONLY. Destructive in nature:
--   - the 0018 subscriptions dedupe is irreversible (deleted rows stay deleted);
--   - dropping payment_plan_requests loses open plan-request rows (and their
--     paused-run state);
--   - restores the vulnerable subs_all_own policy schema exactly as pre-0018.
-- If 0019 was also applied, run 0019_down first, then this.

-- D13: restore the pre-0018 FOR ALL policy on subscriptions (the vulnerability
-- 0018 removed). A rollback must reproduce the prior schema exactly.
drop policy if exists "subs_all_own" on public.subscriptions;
create policy "subs_all_own" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- D15: drop the single-subscription-per-user constraint.
drop index if exists public.subscriptions_user_uidx;

-- D08: drop the one-active-run-per-invoice guard.
drop index if exists public.runs_one_active_per_invoice;

-- D02: drop the delivery-tracking columns.
alter table public.settlement_offers
  drop column if exists delivered_at,
  drop column if exists viewed_at;

-- D10: remove the message write-ahead status column + its indexes.
alter table public.messages drop column if exists status;
drop index if exists public.idx_messages_run_step;
drop index if exists public.idx_messages_resend_message_id;

-- D24: drop payment-plan requests (policies + index die with the table).
drop table if exists public.payment_plan_requests;

-- D09: revert the seeded ladder delay fix to the pre-0018 values. Direct inverse
-- of the forward update: step 2 nudge goes back to 7 for the fixed 4-rung seeds.
update public.sequences
set steps = (
  select jsonb_agg(
    case
      when s.value->>'tone' = 'nudge' then s.value || '{"delay_days":7}'::jsonb
      else s.value
    end
    order by (s.value->>'step_order')::int
  )
  from jsonb_array_elements(steps) s
)
where steps @> '[{"step_order":1,"delay_days":1,"tone":"gentle"}]'::jsonb
  and steps @> '[{"step_order":2,"delay_days":6,"tone":"nudge"}]'::jsonb
  and jsonb_array_length(steps) = 4;