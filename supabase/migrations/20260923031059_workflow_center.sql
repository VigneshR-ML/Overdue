-- Extends the owner notification center with a delivery activity category.
alter table public.owner_notifications
  drop constraint if exists owner_notifications_type_check;

alter table public.owner_notifications
  add constraint owner_notifications_type_check check (type in (
    'settlement_accepted', 'payment_promise', 'payment_plan', 'dispute',
    'invoice_paid', 'reply_received', 'payment_link_needed', 'reminder_sent'
  ));
