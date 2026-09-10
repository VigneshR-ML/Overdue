-- 0009: per-invoice payment URL for "Pay now" buttons in reminders.
-- Auto-filled from Stripe hosted_invoice_url / Xero OnlineInvoiceUrl at sync
-- time; editable for manual and CSV invoices. Safe to re-run.
alter table public.invoices
  add column if not exists payment_url text;
