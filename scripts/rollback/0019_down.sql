-- 0019_down: reverse 0019_api_write_boundary.sql.
-- EMERGENCY ROLLBACK ONLY: restores the client (anon/authenticated) Data-API
-- write path and the FOR ALL ownership policies 0019 removed, re-opening the
-- direct-Data-API bypass of quotas/validation/scheduler guards.
-- Run before 0018_down if both were applied.

-- Recreate the FOR ALL / insert policies 0019 dropped (drop-guards keep the
-- file idempotent, same defensive style as the up migrations).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "integrations_all_own" on public.integrations;
create policy "integrations_all_own" on public.integrations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "clients_all_own" on public.clients;
create policy "clients_all_own" on public.clients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "invoices_all_own" on public.invoices;
create policy "invoices_all_own" on public.invoices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "sequences_all_own" on public.sequences;
create policy "sequences_all_own" on public.sequences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "runs_all_own" on public.runs;
create policy "runs_all_own" on public.runs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "messages_all_own" on public.messages;
create policy "messages_all_own" on public.messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "reply_intel_all_own" on public.reply_intel;
create policy "reply_intel_all_own" on public.reply_intel
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "disputes_all_own" on public.disputes;
create policy "disputes_all_own" on public.disputes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists settlements_all_own on public.settlement_offers;
create policy settlements_all_own on public.settlement_offers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists settlement_events_all_own on public.settlement_events;
create policy settlement_events_all_own on public.settlement_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists payment_plan_all_own on public.payment_plan_requests;
create policy payment_plan_all_own on public.payment_plan_requests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Restore pre-0019 table privileges: supabase default ACLs (anon + authenticated)
-- EXCEPT where an earlier migration had already revoked. Deliberately omitted:
--   - settlement_offers / settlement_events: anon was revoked by 0016
--   - payment_plan_requests: anon was revoked by 0018
--   - integration_credentials: locked down by 0012 (revoked before 0019)
-- (service_role keeps RLS bypass and was never restricted.)
grant all on table public.profiles to anon, authenticated;
grant all on table public.subscriptions to anon, authenticated;
grant all on table public.integrations to anon, authenticated;
grant all on table public.clients to anon, authenticated;
grant all on table public.invoices to anon, authenticated;
grant all on table public.sequences to anon, authenticated;
grant all on table public.runs to anon, authenticated;
grant all on table public.messages to anon, authenticated;
grant all on table public.webhook_events to anon, authenticated;
grant all on table public.ai_usage to anon, authenticated;
grant all on table public.reply_intel to anon, authenticated;
grant all on table public.disputes to anon, authenticated;
grant all on table public.settlement_offers to authenticated;
grant all on table public.settlement_events to authenticated;
grant all on table public.payment_plan_requests to authenticated;
-- integration_credentials intentionally NOT re-granted (0012 locked it pre-0019).