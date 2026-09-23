import { notifyOwner } from "@/lib/notifications/owner";
/**
 * Reconciliation applied once an invoice is confirmed paid, by any path:
 * the invoice PATCH ("mark paid"), and the provider payment webhooks
 * (stripe / paypal / xero) in paid-webhooks.ts.
 *
 * Everything that was chasing the invoice must end up in one state:
 *   - runs          → cancelled   (stop the ladder)
 *   - disputes      → resolved    (nothing left to dispute)
 *   - offers        → paid        (settlement succeeded)
 *   - plan_requests → closed(invoice_paid_directly) (direct payment, not cancellation)
 *   - plans         → completed(direct_invoice_payment) + installments cancelled
 *   - payments      → ledger row (normalized source of truth)
 */
export async function reconcilePaidWork(
  supabase: any,
  opts: { userId: string; invoiceId: string; source: string },
): Promise<void> {
  const now = new Date().toISOString()
  const ledgerSource = opts.source.includes("stripe") ? "stripe"
    : opts.source.includes("paypal") ? "paypal"
    : opts.source.includes("xero") ? "xero_sync"
    : opts.source.includes("manual") ? "manual" : "bank_transfer";

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
    .select("id, status")
    .eq("invoice_id", opts.invoiceId)
    .eq("user_id", opts.userId)
    .in("status", ["approved", "sent", "accepted", "suspended"])

  const offers = (data ?? []) as { id: string; status: string }[]
  if (offers.length) {
    // Live offers paid through the offer -> paid. Suspended offers open at direct
    // payment time were never paid through -> cancelled (superseded_by_direct_payment),
    // preserving settlement conversion reporting. Missing status (test mocks /
    // legacy rows) is treated as live to stay backward-compatible.
    const live = offers.filter((o) => !o.status || ["approved", "sent", "accepted"].includes(o.status));
    const suspended = offers.filter((o) => o.status === "suspended");
    if (live.length) {
      await supabase
        .from("settlement_offers")
        .update({ status: "paid", updated_at: now })
        .eq("invoice_id", opts.invoiceId)
        .eq("user_id", opts.userId)
        .in("status", ["approved", "sent", "accepted"])
      await supabase.from("settlement_events").insert(
        live.map((o) => ({
          offer_id: o.id,
          user_id: opts.userId,
          event: "paid",
          meta: { source: opts.source },
        })),
      )
    }
    if (suspended.length) {
      await supabase
        .from("settlement_offers")
        .update({ status: "cancelled", updated_at: now })
        .eq("invoice_id", opts.invoiceId)
        .eq("user_id", opts.userId)
        .eq("status", "suspended")
      await supabase.from("settlement_events").insert(
        suspended.map((o) => ({
          offer_id: o.id,
          user_id: opts.userId,
          event: "cancelled",
          meta: { source: opts.source, reason: "superseded_by_direct_payment" },
        })),
      )
    }
  }

  await notifyOwner(supabase, {
    userId: opts.userId,
    type: "invoice_paid",
    title: "Payment recorded",
    body: "An invoice was marked paid and its reminders were stopped.",
    href: `/invoices/${opts.invoiceId}`,
    dedupeKey: `invoice-paid:${opts.invoiceId}`,
    meta: { invoice_id: opts.invoiceId, source: opts.source },
  }).catch(() => {});
  // Direct payment closes plan requests as completed recovery (not cancellation).
  try {
    await supabase.from("payment_plan_requests")
      .update({ status: "closed", close_reason: "invoice_paid_directly", decided_at: now })
      .eq("invoice_id", opts.invoiceId).eq("user_id", opts.userId)
      .in("status", ["submitted", "under_review", "open"]);
    const { data: plans } = await supabase.from("payment_plans").select("id")
      .eq("invoice_id", opts.invoiceId).in("status", ["proposed", "active", "delinquent"]);
    for (const p of ((plans ?? []) as { id: string }[])) {
      await supabase.from("payment_plans").update({ status: "completed", completion_source: "direct_invoice_payment", updated_at: now }).eq("id", p.id);
      await supabase.from("plan_installments").update({ status: "cancelled" }).eq("payment_plan_id", p.id).in("status", ["scheduled", "due", "overdue", "partially_paid"]);
    }
    await (supabase.from("workflow_events") as unknown as { insert: (r: unknown) => Promise<unknown> }).insert({
      user_id: opts.userId, invoice_id: opts.invoiceId, event_type: "invoice_paid",
      actor_type: "system", payload: { source: ledgerSource },
    });
  } catch { /* pre-migration tables */ }
}
