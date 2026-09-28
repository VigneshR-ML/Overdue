-- 0028: close the manual-payment dual-control audit boundary.
--
-- 0023 created public.manual_payment_approvals and its RLS/revoke block covered
-- only notifications, debtor_portal_sessions, webhook_receipts and outbox_jobs.
-- Nothing since has protected this table, so it kept the Supabase default
-- privileges that grant anon/authenticated full access to new public tables.
--
-- Effect before this migration: any signed-in user could read another
-- workspace's manual-payment approval trail via PostgREST, and -- because
-- `confirmed_by` is the record of the second approver -- could write it
-- directly, defeating the two-person control on manual payments. The API
-- boundary in 0019 already assumes every business table is revoked and
-- RLS-guarded; this restores that invariant for the one table that was missed.
--
-- Additive and idempotent, safe after 0023.

do $$
begin
  if to_regclass('public.manual_payment_approvals') is null then
    raise exception 'manual_payment_approvals missing — 0023 not applied';
  end if;
end $$;

alter table public.manual_payment_approvals enable row level security;

revoke all on table public.manual_payment_approvals from anon, authenticated;

-- Readable only by members of the workspace that owns the payment. Access is
-- resolved through public.payments.workspace_id because the approval row
-- itself carries no workspace column.
--
-- Only a SELECT policy is created. INSERT/UPDATE/DELETE stay denied to the
-- client roles by RLS default-deny: the app writes this table exclusively
-- through the service-role admin client in the manual-payment routes, so
-- server behaviour is unchanged.
drop policy if exists manual_payment_approvals_select on public.manual_payment_approvals;
create policy manual_payment_approvals_select on public.manual_payment_approvals
  for select to authenticated using (
    exists (
      select 1 from public.payments p
      where p.id = payment_id and public.is_workspace_member(p.workspace_id)
    )
  );

grant select on table public.manual_payment_approvals to authenticated;


-- Atomic dual-control confirmation.
--
-- The route previously performed three independent writes: mark the payment
-- confirmed, stamp `confirmed_by` on the approval row, then reconcile. The
-- approval write's result was never checked, so a failure there returned 200
-- with the payment confirmed and the approver silently missing from the audit
-- trail. Doing both updates in one transaction makes the audit record
-- inseparable from the state change it documents.
--
-- Returns false when the payment is not pending (already confirmed or changed),
-- which preserves the existing optimistic-concurrency behaviour the route
-- relies on. Raises when no approval row exists, because confirming a payment
-- without a recorded approval would defeat the two-person control.
create or replace function public.confirm_manual_payment_approval(
  p_payment_id uuid,
  p_member_id uuid,
  p_confirmer uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated uuid;
  v_approvals int;
begin
  update public.payments
     set status = 'confirmed',
         recorded_by_member_id = p_member_id,
         paid_at = now()
   where id = p_payment_id
     and status = 'pending'
  returning id into v_updated;

  if v_updated is null then
    return false;
  end if;

  update public.manual_payment_approvals
     set confirmed_by = p_confirmer
   where payment_id = p_payment_id;
  get diagnostics v_approvals = row_count;

  if v_approvals = 0 then
    raise exception 'manual payment % has no approval record; refusing to confirm', p_payment_id
      using errcode = 'integrity_constraint_violation';
  end if;

  return true;
end;
$$;

revoke all on function public.confirm_manual_payment_approval(uuid, uuid, uuid) from public;
grant execute on function public.confirm_manual_payment_approval(uuid, uuid, uuid) to service_role;
