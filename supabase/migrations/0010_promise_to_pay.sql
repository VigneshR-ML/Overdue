-- 0010: promise-to-pay tracking on runs.
-- When a client reply contains a payment promise ("will pay Friday"), the run
-- waits in 'queued' with next_run_at = promise date instead of escalating.
-- Safe to re-run.
alter table public.runs
  add column if not exists promise_date timestamptz,
  add column if not exists promise_note text,
  add column if not exists promise_amount_cents int;
