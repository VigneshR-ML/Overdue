-- tenant-precheck.sql — READ-ONLY pre-flight for applying 0018/0019 to a
-- database that may already contain tenant data. No DML: every statement is a
-- SELECT. Run against the LIVE database BEFORE migrating, and again afterwards:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/tenant-precheck.sql
-- The "→ FIX" lines point at docs/audit/RUNBOOK_DATA_REPAIR.md.

\echo '== 1. Migration state already applied? =='
SELECT
  (to_regclass('public.subscriptions_user_uidx') IS NOT NULL)      AS m0018_subs_uidx,
  (to_regclass('public.runs_one_active_per_invoice') IS NOT NULL)  AS m0018_active_run_idx,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payment_plan_requests' AND policyname='payment_plan_all_own') AS m0019_wide_policy_present
;

\echo '== 2. D09 — seeded ladders still on the old [1,7,7,7] schedule =='
-- step 1 = gentle delay 1 + step 2 = nudge delay 7 in a 4-step ladder is the
-- pre-fix seed. 0018 repairs these automatically; rows here mean it has NOT
-- been applied (or a seed was created after).
SELECT id, name
FROM public.sequences
WHERE steps @> '[{"step_order":1,"delay_days":1,"tone":"gentle"}]'::jsonb
  AND steps @> '[{"step_order":2,"delay_days":7,"tone":"nudge"}]'::jsonb
  AND jsonb_array_length(steps) = 4;

\echo '== 3. D15 — duplicate subscription rows per user =='
SELECT user_id, count(*) AS rows, string_agg(billing_provider || ':' || COALESCE(paddle_subscription_id, dodo_subscription_id, '?'), ', ' ORDER BY created_at) AS providers
FROM public.subscriptions
GROUP BY user_id
HAVING count(*) > 1
ORDER BY rows DESC;

\echo '== 4. D08 — invoices with more than one ACTIVE run =='
-- Active = the set the partial unique index protects. Pre-existing dupes cause
-- that index creation to be skipped, so resolving these BEFORE the migration is
-- required for the guard to land (→ FIX in RUNBOOK_DATA_REPAIR.md).
SELECT r.invoice_id, count(*) AS active_runs, string_agg(r.id::text, ', ' ORDER BY r.created_at) AS run_ids
FROM public.runs r
WHERE r.status IN ('queued','processing','sent','paused')
GROUP BY r.invoice_id
HAVING count(*) > 1
ORDER BY active_runs DESC;

\echo '== 5. Orphaned runs (sequence or invoice row missing) =='
SELECT r.id, r.user_id, r.sequence_id, r.invoice_id, r.status
FROM public.runs r
LEFT JOIN public.sequences s ON s.id = r.sequence_id
LEFT JOIN public.invoices i ON i.id = r.invoice_id
WHERE s.id IS NULL OR i.id IS NULL
ORDER BY r.created_at DESC
LIMIT 50;

\echo '== 6. Messages with no matching run (write-ahead leftovers) =='
SELECT m.id, m.run_id, m.status, m.created_at
FROM public.messages m
LEFT JOIN public.runs r ON r.id = m.run_id
WHERE r.id IS NULL
ORDER BY m.created_at DESC
LIMIT 50;

\echo '== 7. Settlement offers past expiry still marked approved/sent =='
SELECT id, invoice_id, offer_cents, status, expires_at
FROM public.settlement_offers
WHERE status IN ('approved','sent')
  AND expires_at < now()
ORDER BY expires_at
LIMIT 50;

\echo '== 8. Invalid currency values (multi-currency hygiene) =='
SELECT currency, count(*) AS invoices
FROM public.invoices
WHERE currency IS NOT NULL
  AND upper(currency) NOT SIMILAR TO '[A-Z]{3}'
GROUP BY currency
ORDER BY invoices DESC
LIMIT 20;

\echo '== 9. runs stuck in processing > 5 min (crashed batch) =='
SELECT id, invoice_id, status, updated_at
FROM public.runs
WHERE status = 'processing'
  AND updated_at < now() - interval '5 minutes'
ORDER BY updated_at
LIMIT 50;