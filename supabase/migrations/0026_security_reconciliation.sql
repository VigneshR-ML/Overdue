-- 0026: close security and money-ledger gaps from the workspace rollout.
-- This is additive so it is safe after 0021-0025.

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.payment_plan_settings enable row level security;
alter table public.payment_plans enable row level security;
alter table public.plan_installments enable row level security;
alter table public.payments enable row level security;
alter table public.checkout_attempts enable row level security;
alter table public.workflow_events enable row level security;
alter table public.notifications enable row level security;

-- Store renderable copy alongside the normalized notification target. These
-- fields keep the feed useful even if the originating invoice changes later.
alter table public.notifications add column if not exists title text not null default 'Workflow update';
alter table public.notifications add column if not exists body text not null default '';
alter table public.notifications add column if not exists href text;

alter table public.payments add column if not exists reference text;
alter table public.payments add column if not exists proof_url text;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'workspaces','workspace_members','payment_plan_settings','payment_plans',
    'plan_installments','payments','checkout_attempts','workflow_events','notifications'
  ] loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

drop policy if exists workspace_member_select on public.workspaces;
create policy workspace_member_select on public.workspaces
  for select to authenticated using (public.is_workspace_member(id));

drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists plan_settings_select on public.payment_plan_settings;
create policy plan_settings_select on public.payment_plan_settings
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists plans_select on public.payment_plans;
create policy plans_select on public.payment_plans
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists installments_select on public.plan_installments;
create policy installments_select on public.plan_installments
  for select to authenticated using (
    exists (
      select 1 from public.payment_plans p
      where p.id = payment_plan_id and public.is_workspace_member(p.workspace_id)
    )
  );

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists checkout_select on public.checkout_attempts;
create policy checkout_select on public.checkout_attempts
  for select to authenticated using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id and public.is_workspace_member(i.workspace_id)
    )
  );

drop policy if exists workflow_events_select on public.workflow_events;
create policy workflow_events_select on public.workflow_events
  for select to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (
    recipient_member_id in (
      select id from public.workspace_members where user_id = (select auth.uid())
    )
  );

-- Backfill every business row, not only invoices, before the app starts
-- relying on workspace membership.
update public.clients c set workspace_id = m.workspace_id
from public.workspace_members m
where c.workspace_id is null and m.user_id = c.user_id;
update public.sequences s set workspace_id = m.workspace_id
from public.workspace_members m
where s.workspace_id is null and m.user_id = s.user_id;
update public.runs r set workspace_id = m.workspace_id
from public.workspace_members m
where r.workspace_id is null and m.user_id = r.user_id;
update public.messages x set workspace_id = m.workspace_id
from public.workspace_members m
where x.workspace_id is null and m.user_id = x.user_id;
update public.disputes d set workspace_id = m.workspace_id
from public.workspace_members m
where d.workspace_id is null and m.user_id = d.user_id;
update public.settlement_offers o set workspace_id = m.workspace_id
from public.workspace_members m
where o.workspace_id is null and m.user_id = o.user_id;
update public.payment_plan_requests q set workspace_id = m.workspace_id
from public.workspace_members m
where q.workspace_id is null and m.user_id = q.user_id;
