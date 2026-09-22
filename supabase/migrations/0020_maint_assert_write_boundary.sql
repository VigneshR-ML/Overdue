-- 0020: maintenance prober for G5 — asserts that 0018+0019 are actually
-- enforced on a database. Read-only (schema metadata only; no table data).
-- Called by scripts/assert-write-boundary.mjs over REST with the service role.
-- SECURITY DEFINER (runs as owner) + locked search_path so pg_catalog views are
-- readable regardless of the caller; EXECUTE is limited to service_role.

create or replace function public.assert_write_boundary()
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  problems jsonb := '[]'::jsonb;
  subject text;
  read_ok boolean; ins_ok boolean; upd_ok boolean; del_ok boolean;
  policy text;
begin
  -- 1) authenticated: owner reads OK, writes forbidden (profiles keeps UPDATE).
  foreach subject in array array[
      'profiles','subscriptions','integrations','clients','invoices','sequences',
      'runs','messages','reply_intel','disputes','settlement_offers',
      'settlement_events','payment_plan_requests']
  loop
    select
      has_table_privilege('authenticated', 'public.' || subject, 'SELECT'),
      has_table_privilege('authenticated', 'public.' || subject, 'INSERT'),
      has_table_privilege('authenticated', 'public.' || subject, 'UPDATE'),
      has_table_privilege('authenticated', 'public.' || subject, 'DELETE')
    into read_ok, ins_ok, upd_ok, del_ok;
    if subject = 'profiles' then
      if not (read_ok and upd_ok and not ins_ok and not del_ok) then
        problems := problems || jsonb_build_object('check', 'auth_profiles', 'ok', false,
          'detail', format('SELECT=%L INSERT=%L UPDATE=%L DELETE=%L', read_ok, ins_ok, upd_ok, del_ok));
      end if;
    elsif not (read_ok and not ins_ok and not upd_ok and not del_ok) then
      problems := problems || jsonb_build_object('check', 'auth_' || subject, 'ok', false,
        'detail', format('SELECT=%L INSERT=%L UPDATE=%L DELETE=%L', read_ok, ins_ok, upd_ok, del_ok));
    end if;
  end loop;

  -- 2) fully locked tables: authenticated reads NOTHING.
  foreach subject in array array['webhook_events','integration_credentials','ai_usage']
  loop
    if has_table_privilege('authenticated', 'public.' || subject, 'SELECT') then
      problems := problems || jsonb_build_object('check', 'auth_locked_' || subject, 'ok', false,
        'detail', 'SELECT granted — should be locked');
    end if;
  end loop;

  -- 3) anon: no SELECT anywhere in the write-boundary set.
  foreach subject in array array[
      'profiles','subscriptions','integrations','clients','invoices','sequences',
      'runs','messages','webhook_events','integration_credentials','ai_usage',
      'reply_intel','disputes','settlement_offers','settlement_events',
      'payment_plan_requests']
  loop
    if has_table_privilege('anon', 'public.' || subject, 'SELECT') then
      problems := problems || jsonb_build_object('check', 'anon_' || subject, 'ok', false,
        'detail', 'anon can SELECT');
    end if;
  end loop;

  -- 4) 0018 schema artifacts present.
  if to_regclass('public.subscriptions_user_uidx') is null then
    problems := problems || jsonb_build_object('check', 'm0018_subs_uidx', 'ok', false,
      'detail', 'missing — 0018 not applied');
  end if;
  if to_regclass('public.runs_one_active_per_invoice') is null then
    problems := problems || jsonb_build_object('check', 'm0018_active_run_idx', 'ok', false,
      'detail', 'missing — 0018 skipped it (dirty data?) or not applied');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'messages' and column_name = 'status') then
    problems := problems || jsonb_build_object('check', 'm0018_messages_status', 'ok', false,
      'detail', 'column missing');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'settlement_offers' and column_name = 'delivered_at') then
    problems := problems || jsonb_build_object('check', 'm0018_delivered_at', 'ok', false,
      'detail', 'column missing');
  end if;

  -- 5) 0019: the wide FOR ALL / insert policies are gone.
  foreach policy in array array[
      'profiles_insert_own','integrations_all_own','clients_all_own',
      'invoices_all_own','sequences_all_own','runs_all_own','messages_all_own',
      'reply_intel_all_own','disputes_all_own','settlements_all_own',
      'settlement_events_all_own','payment_plan_all_own','subs_all_own']
  loop
    if exists (select 1 from pg_policies p where p.schemaname = 'public' and p.policyname = policy) then
      problems := problems || jsonb_build_object('check', 'policy_left_' || policy, 'ok', false,
        'detail', 'policy still present');
    end if;
  end loop;

  return jsonb_build_object(
    'ok', problems = '[]'::jsonb,
    'problems', problems,
    'checked_at', now()
  );
end
$$;

revoke all on function public.assert_write_boundary() from public;
revoke all on function public.assert_write_boundary() from anon, authenticated;
grant execute on function public.assert_write_boundary() to service_role;