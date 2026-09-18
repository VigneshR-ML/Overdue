-- 0018: Hardening fixes from the launch audit (D02/D08/D09/D10/D13/D15/D24).
-- Safe to re-run: guarded with IF NOT EXISTS / EXCEPTION blocks.
--
-- D13  Lock down subscriptions: authenticated users could forge their own
--      plan/status/provider ids via the subs_all_own policy (0001). Clients
--      only need SELECT; all writes flow through service-role webhooks/reconcile.
drop policy if exists "subs_all_own" on public.subscriptions;

-- D15: enforce a single subscription row per user. Free placeholder rows and
-- re-subscribes created duplicates; getPlan() hides the mess with
-- "order by created_at desc limit 1". Dedupe now, constrain going forward
-- (every upsert must switch to onConflict: "user_id").
with ranked as (
  select id, user_id,
    row_number() over (
      partition by user_id
      order by
        (billing_provider = 'paddle' and paddle_subscription_id is not null) desc,
        (billing_provider = 'dodo'    and dodo_subscription_id    is not null) desc,
        (plan = 'pro') desc,
        created_at desc,
        id
    ) as rn
  from public.subscriptions
)
delete from public.subscriptions s
using ranked r
where s.id = r.id and r.rn > 1;

do $$ begin
  create unique index if not exists subscriptions_user_uidx
    on public.subscriptions (user_id);
exception when unique_violation then null; end $$;

-- D08: a single active automated run per invoice — a second ladder on the same
-- invoice would double-email the same debtor. failed/completed runs don't block
-- a fresh retry.
do $$ begin
  create unique index if not exists runs_one_active_per_invoice
    on public.runs (invoice_id)
    where status in ('queued','processing','sent','paused');
exception when unique_violation then null; end $$;

-- D02: track when an offer actually went out / was first viewed. The token page
-- used to flip approved -> sent on view (a fake delivery signal); dispatchOne now
-- stamps sent + delivered_at, resolution views stamp viewed_at.
alter table public.settlement_offers
  add column if not exists delivered_at timestamptz,
  add column if not exists viewed_at timestamptz;

-- D10: message write-ahead for idempotent sends. dispatchOne inserts the message
-- row BEFORE calling the provider (status='sending'), then flips it to
-- 'sent'/'failed'. A re-dispatch skips any (run_id, step) already
-- 'sending'/'sent', so a crash/retry can never double-send. sent_at keeps
-- defaulting to now() so existing rows stay valid.
alter table public.messages
  add column if not exists status text not null default 'sent'
    check (status in ('sending','sent','failed'));

create index if not exists idx_messages_run_step
  on public.messages (run_id, step);

create index if not exists idx_messages_resend_message_id
  on public.messages (resend_message_id);

-- D24: payment-plan requests surfaced through the settlement flow need a home
-- row so the owner can see and act on them (the dispatcher pauses the ladder
-- while one is open).
create table if not exists public.payment_plan_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_id uuid references public.settlement_offers (id) on delete set null,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  requested_cents int check (requested_cents is null or requested_cents > 0),
  message text not null default '',
  status text not null default 'open' check (status in ('open','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_plan_requests enable row level security;

drop policy if exists payment_plan_select_own on public.payment_plan_requests;
create policy payment_plan_select_own on public.payment_plan_requests
  for select using (auth.uid() = user_id);
drop policy if exists payment_plan_all_own on public.payment_plan_requests;
create policy payment_plan_all_own on public.payment_plan_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.payment_plan_requests from anon;

create index if not exists payment_plan_requests_invoice_idx
  on public.payment_plan_requests (invoice_id, status);

-- D09: fix mislabeled seeded ladder delays. delay_days is days after the previous
-- rung, so the Standard Ladder must be [1,6,7,7] to actually send on cumulative
-- days 1,7,14,21. Correct any copies already seeded from the old values.
update public.sequences
set steps = (
  select jsonb_agg(
    case
      when s.value->>'tone' = 'nudge' then s.value || '{"delay_days":6}'::jsonb
      else s.value
    end
    order by (s.value->>'step_order')::int
  )
  from jsonb_array_elements(steps) s
)
where steps @> '[{"step_order":1,"delay_days":1,"tone":"gentle"}]'::jsonb
  and steps @> '[{"step_order":2,"delay_days":7,"tone":"nudge"}]'::jsonb
  and jsonb_array_length(steps) = 4;