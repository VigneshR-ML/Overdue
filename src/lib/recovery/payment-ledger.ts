import { reconcilePaidWork } from "@/lib/recovery/paid"

export type PaymentReconciliation = {
  invoice_id: string
  user_id: string
  workspace_id: string | null
  applied_cents: number
  fully_paid: boolean
  plan_completed: boolean
  already_reconciled?: boolean
}

/** Applies one confirmed payment through the database transaction in 0027.
 * Retries are safe: reconciled_at makes the operation idempotent. */
export async function reconcileConfirmedPayment(
  supabase: any,
  paymentId: string,
): Promise<{ ok: true; result: PaymentReconciliation } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("reconcile_confirmed_payment", {
    p_payment_id: paymentId,
  })
  if (error) return { ok: false, error: error.message ?? "payment reconciliation failed" }
  const result = (data ?? {}) as PaymentReconciliation
  if (!result.invoice_id || !result.user_id) {
    return { ok: false, error: "payment reconciliation returned an invalid result" }
  }
  if (result.fully_paid && !result.already_reconciled) {
    await reconcilePaidWork(supabase, {
      userId: result.user_id,
      invoiceId: result.invoice_id,
      source: "confirmed_payment",
    })
  }
  return { ok: true, result }
}
