-- 0025: Launch blockers — runs.cancelled, zero-owner enforcement, cron heartbeat, team invites.
-- Fixes review items 1,5 + needs-answers (legacy, transfer, monitoring).

-- 5) runs.status missing cancelled (0004 check lacks it, paid.ts writes it)
do $$ begin
  alter table public.runs drop constraint if exists runs_status_check;
exception when undefined_object then null; end $$;
alter table public.runs add constraint runs_status_check
  check (status in ('queued','processing','sent','completed','paused','failed','cancelled'));

-- Legacy backfill confirmation: canonicalize old payment_plan_requests values
update public.payment_plan_requests set status = 'under_review' where status = 'open';
update public.payment_plan_requests set status = 'converted' where status = 'accepted';
update public.payment_plan_requests set status = 'closed', close_reason = coalesce(close_reason, 'owner_declined') where status = 'declined';
-- subscriptions.trialing is intentional (entitlement grants pro for active|trialing); no backfill.

-- Webhook idempotency rule (item 3): webhook_events is canonical for dedupe;
-- webhook_receipts is observability metadata. Enforce via unique + document.
-- No schema change needed; assert both exist.
do $$ begin
  if to_regclass('public.webhook_events') is null then raise exception 'webhook_events missing'; end if;
  if to_regclass('public.webhook_receipts') is null then raise exception 'webhook_receipts missing — 0023 not applied'; end if;
end $$;

-- Never-zero-owners: DB-enforced (was app-rule only)
create or replace function public.prevent_zero_owners()
returns trigger language plpgsql as $$
declare owner_count int;
begin
  if TG_OP = 'DELETE' then
    select count(*) into owner_count from public.workspace_members
      where workspace_id = OLD.workspace_id and role = 'owner' and id <> OLD.id;
    if owner_count = 0 then raise exception 'workspace must retain at least one owner'; end if;
    return OLD;
  else
    -- downgrade/remove owner role
    if OLD.role = 'owner' and NEW.role <> 'owner' then
      select count(*) into owner_count from public.workspace_members
        where workspace_id = OLD.workspace_id and role = 'owner' and id <> OLD.id;
      if owner_count = 0 then raise exception 'workspace must retain at least one owner'; end if;
    end if;
    return NEW;
  end if;
end $$;

drop trigger if exists trg_workspace_no_zero_owners on public.workspace_members;
create trigger trg_workspace_no_zero_owners
  before update or delete on public.workspace_members
  for each row execute function public.prevent_zero_owners();

-- Team invites + ownership transfer (were tables-only; add minimal lifecycle)
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member','viewer')),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create table if not exists public.ownership_transfers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  from_user uuid not null references auth.users (id),
  to_user uuid not null references auth.users (id),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now()
);

-- Cron heartbeat for dead-man monitoring (item 6: vercel crons empty, single GitHub path)
create table if not exists public.cron_heartbeats (
  id uuid primary key default gen_random_uuid(),
  job text not null default 'dispatch',
  ok boolean not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists cron_heartbeats_job_time_idx on public.cron_heartbeats (job, created_at desc);

alter table public.workspace_invites enable row level security;
alter table public.ownership_transfers enable row level security;
alter table public.cron_heartbeats enable row level security;
revoke all on table public.workspace_invites from anon, authenticated;
revoke all on table public.ownership_transfers from anon, authenticated;
revoke all on table public.cron_heartbeats from anon, authenticated;
grant select on table public.workspace_invites to authenticated;
grant select on table public.ownership_transfers to authenticated;
grant select on table public.cron_heartbeats to authenticated;
