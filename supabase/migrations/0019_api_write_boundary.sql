-- 0019: Enforce the application API as the only write boundary.
--
-- The public Supabase URL/key are intentionally visible in the browser. RLS
-- ownership policies prevented cross-tenant access, but the broad FOR ALL
-- policies still let a signed-in user call the Data API directly and bypass
-- plan quotas, validation, settlement state transitions and scheduler guards.
-- Keep owner reads available to the authenticated application; all business
-- writes now use the server-only service role after an explicit ownership
-- check. Profiles remain user-editable for the onboarding identity form.

drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "integrations_all_own" on public.integrations;
drop policy if exists "clients_all_own" on public.clients;
drop policy if exists "invoices_all_own" on public.invoices;
drop policy if exists "sequences_all_own" on public.sequences;
drop policy if exists "runs_all_own" on public.runs;
drop policy if exists "messages_all_own" on public.messages;
drop policy if exists "reply_intel_all_own" on public.reply_intel;
drop policy if exists "disputes_all_own" on public.disputes;
drop policy if exists settlements_all_own on public.settlement_offers;
drop policy if exists settlement_events_all_own on public.settlement_events;
drop policy if exists payment_plan_all_own on public.payment_plan_requests;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.integrations from anon, authenticated;
revoke all on table public.clients from anon, authenticated;
revoke all on table public.invoices from anon, authenticated;
revoke all on table public.sequences from anon, authenticated;
revoke all on table public.runs from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.webhook_events from anon, authenticated;
revoke all on table public.integration_credentials from anon, authenticated;
revoke all on table public.ai_usage from anon, authenticated;
revoke all on table public.reply_intel from anon, authenticated;
revoke all on table public.disputes from anon, authenticated;
revoke all on table public.settlement_offers from anon, authenticated;
revoke all on table public.settlement_events from anon, authenticated;
revoke all on table public.payment_plan_requests from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.subscriptions to authenticated;
grant select on table public.integrations to authenticated;
grant select on table public.clients to authenticated;
grant select on table public.invoices to authenticated;
grant select on table public.sequences to authenticated;
grant select on table public.runs to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.reply_intel to authenticated;
grant select on table public.disputes to authenticated;
grant select on table public.settlement_offers to authenticated;
grant select on table public.settlement_events to authenticated;
grant select on table public.payment_plan_requests to authenticated;
