-- Backfill completeness check for null-workspace fallback removal.
-- Returns one row per business table with remaining NULL workspace_id counts.
-- When all counts are 0, it is safe to replace the owner fallback with a hard
-- fail and add NOT NULL constraints. Run: psql $DATABASE_URL -f scripts/check-workspace-backfill.sql
select 'invoices' as tbl, count(*) as nulls from public.invoices where workspace_id is null
union all select 'clients', count(*) from public.clients where workspace_id is null
union all select 'sequences', count(*) from public.sequences where workspace_id is null
union all select 'runs', count(*) from public.runs where workspace_id is null
union all select 'messages', count(*) from public.messages where workspace_id is null
union all select 'disputes', count(*) from public.disputes where workspace_id is null
union all select 'settlement_offers', count(*) from public.settlement_offers where workspace_id is null
union all select 'payment_plan_requests', count(*) from public.payment_plan_requests where workspace_id is null
union all select 'reply_intel', count(*) from public.reply_intel where workspace_id is null;
