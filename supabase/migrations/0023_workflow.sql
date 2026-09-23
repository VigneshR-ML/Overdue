-- 0023: Workflow events (append-only), notifications, portal sessions, outbox, receipts.
-- Fixes: orphan enums, missing dedupe/digest, one-time link, dual control audit.

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete cascade,
  plan_id uuid references public.payment_plans (id) on delete set null,
  installment_id uuid references public.plan_installments (id) on delete set null,
  event_type text not null check (event_type in (
    'invoice_created','ladder_attached','reminder_sent','resolve_link_created',
    'promise_recorded','promise_missed','promise_amended',
    'plan_requested','plan_proposed','plan_accepted','plan_declined','plan_countered',
    'installment_due','installment_paid','installment_missed','plan_delinquent',
    'plan_completed','plan_cancelled','settlement_suspended','settlement_resumed',
    'dispute_opened','dispute_resolved','invoice_paid','manual_payment_recorded',
    'portal_link_renewed','ownership_transferred'
  )),
  actor_type text not null default 'system' check (actor_type in ('system','owner','debtor','provider')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists workflow_events_invoice_idx on public.workflow_events (invoice_id, created_at);

-- Append-only: no UPDATE/DELETE for authenticated; service_role enforced via trigger too
alter table public.workflow_events enable row level security;
revoke all on table public.workflow_events from anon, authenticated;
grant select, insert on table public.workflow_events to authenticated;

create or replace function public.reject_workflow_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'workflow_events is append-only';
  return null;
end $$;

drop trigger if exists trg_workflow_no_update on public.workflow_events;
create trigger trg_workflow_no_update before update or delete on public.workflow_events
  for each row execute function public.reject_workflow_mutation();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  recipient_member_id uuid references public.workspace_members (id) on delete cascade,
  type text not null,
  entity_type text not null,
  entity_id uuid,
  dedupe_key text not null,
  channel text not null default 'in_app' check (channel in ('in_app','email')),
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, dedupe_key)
);
create index if not exists notifications_member_idx on public.notifications (recipient_member_id, created_at);

create table if not exists public.debtor_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  plan_id uuid references public.payment_plans (id) on delete set null,
  token_hash text not null,
  issued_to_email text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  issued_reason text not null default 'resolve_link' check (issued_reason in ('resolve_link','fresh_link','plan_portal','renewal')),
  created_at timestamptz not null default now()
);
create index if not exists portal_sessions_invoice_idx on public.debtor_portal_sessions (invoice_id, expires_at);

create table if not exists public.webhook_receipts (
  provider text not null,
  provider_event_id text not null,
  signature_valid boolean not null default false,
  payload_hash text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  attempt_count int not null default 0,
  primary key (provider, provider_event_id)
);

create table if not exists public.outbox_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.workflow_events (id) on delete set null,
  job_type text not null check (job_type in ('email','webhook_retry','reminder','digest')),
  payload jsonb not null default '{}'::jsonb,
  run_after timestamptz not null default now(),
  attempt_count int not null default 0,
  last_error text,
  dead_lettered_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists outbox_run_after_idx on public.outbox_jobs (run_after) where dead_lettered_at is null;

-- Manual payment dual-control audit (amount/proof/actor already in payments; approval chain here)
create table if not exists public.manual_payment_approvals (
  payment_id uuid primary key references public.payments (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  confirmed_by uuid references auth.users (id),
  threshold_cents int not null,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.debtor_portal_sessions enable row level security;
alter table public.webhook_receipts enable row level security;
alter table public.outbox_jobs enable row level security;
revoke all on table public.notifications from anon, authenticated;
revoke all on table public.debtor_portal_sessions from anon, authenticated;
revoke all on table public.webhook_receipts from anon, authenticated;
revoke all on table public.outbox_jobs from anon, authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.debtor_portal_sessions to authenticated;
