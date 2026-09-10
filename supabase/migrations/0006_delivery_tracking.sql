-- 0006: delivery tracking for outbound reminders.
-- Safe to re-run: all statements are IF NOT EXISTS-guarded.

alter table public.messages
  add column if not exists delivered_at timestamptz;

-- Fast lookup of a message's delivery state per run (insights + debugging).
create index if not exists idx_messages_invoice_delivered
  on public.messages (invoice_id, delivered_at);
