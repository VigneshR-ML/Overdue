-- 0021: Workspace tenancy + payment-plan foundation.
-- Backward-compatible: keeps user_id, adds workspace_id nullable for phased migration.
-- New canonical enums fix: request submitted/under_review/converted/closed/expired,
-- plan proposed/active/delinquent/completed/cancelled, settlement +suspended.

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My workspace',
  timezone text not null default 'UTC',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members (user_id);
create index if not exists workspace_members_ws_idx on public.workspace_members (workspace_id);

-- One workspace per existing user (idempotent)
insert into public.workspaces (id, name, created_by)
select gen_random_uuid(), 'My workspace', u.id
from auth.users u
where not exists (select 1 from public.workspace_members m where m.user_id = u.id)
on conflict do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.created_by, 'owner'
from public.workspaces w
where w.created_by is not null
  and not exists (select 1 from public.workspace_members m where m.user_id = w.created_by)
on conflict do nothing;

-- Workspace id on business tables (nullable for phased backfill)
alter table public.invoices add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.clients add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.sequences add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.runs add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.messages add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.disputes add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.settlement_offers add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.settlement_events add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.payment_plan_requests add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.reply_intel add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;

-- Backfill: one owner workspace per user
do $$
declare r record;
begin
  for r in select id, user_id from public.invoices where workspace_id is null limit 10000 loop
    update public.invoices set workspace_id = (select workspace_id from public.workspace_members where user_id = r.user_id limit 1) where id = r.id;
  end loop;
end $$;

create index if not exists invoices_ws_idx on public.invoices (workspace_id);
create index if not exists runs_ws_idx on public.runs (workspace_id);

-- Settlement: add suspended + reason (open item: orphan enum fix)
alter table public.settlement_offers drop constraint if exists settlement_offers_status_check;
alter table public.settlement_offers add constraint settlement_offers_status_check
  check (status in ('draft','approved','sent','suspended','accepted','paid','expired','cancelled'));
alter table public.settlement_offers add column if not exists suspended_reason text;
alter table public.settlement_offers add column if not exists currency text not null default 'USD';

-- Payment-plan requests: canonical enum + close_reason + preferences + expiry/rate-limit fields
alter table public.payment_plan_requests add column if not exists workspace_id uuid references public.workspaces (id) on delete set null;
alter table public.payment_plan_requests add column if not exists frequency text check (frequency is null or frequency in ('weekly','biweekly','monthly'));
alter table public.payment_plan_requests add column if not exists preferred_start_date date;
alter table public.payment_plan_requests add column if not exists preferred_amount_cents int check (preferred_amount_cents is null or preferred_amount_cents > 0);
alter table public.payment_plan_requests add column if not exists close_reason text check (close_reason is null or close_reason in ('owner_declined','debtor_withdrew','invoice_paid_directly','owner_cancelled','expired_no_decision'));
alter table public.payment_plan_requests add column if not exists expires_at timestamptz;
alter table public.payment_plan_requests add column if not exists decided_at timestamptz;

-- Migrate legacy open/accepted/declined/expired -> submitted/under_review/converted/closed/expired
do $$ begin
  alter table public.payment_plan_requests drop constraint if exists payment_plan_requests_status_check;
exception when undefined_object then null; end $$;
alter table public.payment_plan_requests add constraint payment_plan_requests_status_check
  check (status in ('submitted','under_review','converted','closed','expired','open','accepted','declined'));
update public.payment_plan_requests set status = 'under_review' where status = 'open';
update public.payment_plan_requests set status = 'converted', close_reason = coalesce(close_reason, null) where status = 'accepted';
update public.payment_plan_requests set status = 'closed', close_reason = coalesce(close_reason, 'owner_declined') where status = 'declined';
-- keep expired as expired

alter table public.payment_plan_requests enable row level security;
revoke all on table public.workspaces from anon, authenticated;
revoke all on table public.workspace_members from anon, authenticated;
grant select on table public.workspaces to authenticated;
grant select on table public.workspace_members to authenticated;
