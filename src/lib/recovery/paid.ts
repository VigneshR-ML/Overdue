/**
 * Reconciliation applied once an invoice is confirmed paid, by any path:
 * the invoice PATCH ("mark paid"), and the provider payment webhooks
 * (stripe / paypal / xero) in paid-webhooks.ts.
 *
 * Everything that was chasing the invoice must end up in one state:
 *   - runs          → cancelled   (stop the ladder)
 *   - disputes      → resolved    (nothing left to dispute)
 *   - offers        → paid        (settlement succeeded)
 */
export async function reconcilePaidWork(
  supabase: any,
  opts: { userId: string; invoiceId: string; source: string },
): Promise<void> {
  const now = new Date().toISOString()

  await supabase
    .from("runs")
    .update({ status: "cancelled", updated_at: now })
    .eq("invoice_id", opts.invoiceId)
    .eq("user_id", opts.userId)
    .in("status", ["queued", "processing", "sent", "paused"])

  await supabase
    .from("disputes")
    .update({ status: "resolved", resolved_at: now })
    .eq("invoice_id", opts.invoiceId)
    .eq("user_id", opts.userId)
    .eq("status", "open")

  const { data } = await supabase
    .from("settlement_offers")
    .select("id")
    .eq("invoice_id", opts.invoiceId)
    .eq("user_id", opts.userId)
    .in("status", ["approved", "sent", "accepted"])

  const offers = (data ?? []) as { id: string }[]
  if (offers.length) {
    await supabase
      .from("settlement_offers")
      .update({ status: "paid", updated_at: now })
      .eq("invoice_id", opts.invoiceId)
      .eq("user_id", opts.userId)
      .in("status", ["approved", "sent", "accepted"])
    await supabase.from("settlement_events").insert(
      offers.map((o) => ({
        offer_id: o.id,
        user_id: opts.userId,
        event: "paid",
        meta: { source: opts.source },
      })),
    )
  }

  await notifyOwner(supabase, {
    userId: opts.userId,
    type: "invoice_paid",
    title: "Payment recorded",
    body: "An invoice was marked paid and its reminders were stopped.",
    href: `/invoices/${opts.invoiceId}`,
    dedupeKey: `invoice-paid:${opts.invoiceId}`,
    meta: { invoice_id: opts.invoiceId, source: opts.source },
  })
}
import { notifyOwner } from "@/lib/notifications/owner"
