-- Dispatch state hardening.
-- Adds a 'processing' intermediate state so the batch-claim of due runs is
-- atomic (prevents double-send on overlapping crons) without permanently
-- burning runs as 'sent' before the send succeeds. On failure a run returns to
-- 'queued' with an incremented attempt + backoff, so transient errors retry.

alter table public.runs drop constraint runs_status_check;

alter table public.runs add constraint runs_status_check
  check (status in ('queued','processing','sent','completed','paused','failed'));

-- Retry bookkeeping: attempt count so we can cap retries and back off.
alter table public.runs add column if not exists attempt int not null default 0;
alter table public.runs add column if not exists failed_at timestamptz;
alter table public.runs add column if not exists error text;
alter table public.runs add column if not exists updated_at timestamptz not null default now();

-- Dispatcher picks up due runs (queued only; 'processing' is excluded so an
-- in-flight batch that crashed and never finished won't be re-claimed by a new
-- one). Stale 'processing' runs (updated_at older than a few minutes) are
-- requeued by the dispatcher itself.
