import { sendEmail } from "@/lib/resend/send"
import { appUrl } from "@/lib/integrations/oauth"
import { signResolutionToken } from "@/lib/recovery/token"
import { daysOverdue, defaultExpiry, recommendSettlement } from "@/lib/recovery/settlement"
import { formatMoney } from "@/lib/utils/format"

/**
 * Generates at most one debtor-facing resolution proposal for one plan request.
 * It is deliberately opt-in and database-deduplicated: a retry or double click
 * cannot create or email a second proposal for the same request.
 */
export async function createAutoPaymentPlanProposal(supabase: any, input: { requestId: string; userId: string; invoiceId: string }) {
  const { data: settings } = await supabase.from("payment_plan_automation_settings").select("enabled, max_incentive_bps").eq("user_id", input.userId).maybeSingle()
  if (!settings?.enabled) return { created: false, reason: "disabled" as const }

  // Claim the request before doing any financial work. The migration's unique
  // key makes this safe across concurrent public requests/retries.
  const { error: claimError } = await supabase.from("auto_payment_plan_proposals").insert({
    user_id: input.userId, payment_plan_request_id: input.requestId, invoice_id: input.invoiceId,
    offer_cents: 0, incentive_bps: 0, status: "created",
  })
  if (claimError) return { created: false, reason: "already-created" as const }

  const [{ data: invoice }, { data: profile }] = await Promise.all([
    supabase.from("invoices").select("id, number, currency, amount_cents, paid_cents, due_date, client_id, clients(name, billing_email, email)").eq("id", input.invoiceId).eq("user_id", input.userId).maybeSingle(),
    supabase.from("profiles").select("full_name, email").eq("id", input.userId).maybeSingle(),
  ])
  const client = invoice?.clients
  const recipient = client?.billing_email ?? client?.email ?? null
  const outstanding = Math.max(0, Number(invoice?.amount_cents ?? 0) - Number(invoice?.paid_cents ?? 0))
  if (!invoice || !recipient || outstanding <= 0) {
    await supabase.from("auto_payment_plan_proposals").update({ status: "delivery_failed" }).eq("payment_plan_request_id", input.requestId)
    return { created: false, reason: "missing-invoice-or-email" as const }
  }
  const { data: clientHistory } = invoice.client_id
    ? await supabase.from("clients").select("avg_payment_days").eq("id", invoice.client_id).eq("user_id", input.userId).maybeSingle()
    : { data: null }
  const maxBps = Math.max(0, Math.min(2000, Number(settings.max_incentive_bps ?? 500)))
  const recommendation = recommendSettlement({
    outstandingCents: outstanding,
    daysOverdue: daysOverdue(invoice.due_date),
    history: { avgLateDays: typeof clientHistory?.avg_payment_days === "number" ? clientHistory.avg_payment_days : null, openRate: null, disputeRate: null },
    minAcceptableCents: Math.ceil(outstanding * (1 - maxBps / 10000)),
    maxIncentiveBps: maxBps,
  })
  const choice = recommendation.recommended
  const expiresAt = defaultExpiry()

  // One active resolution offer per invoice makes the amount shown in every
  // subsequent email and public page consistent.
  await supabase.from("settlement_offers").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("user_id", input.userId).eq("invoice_id", invoice.id).in("status", ["approved", "sent"])
  const { data: offer, error: offerError } = await supabase.from("settlement_offers").insert({
    user_id: input.userId, invoice_id: invoice.id, outstanding_cents: outstanding,
    offer_cents: choice.offerCents, incentive_cents: choice.incentiveCents,
    basis: "discount", min_acceptable_cents: Math.ceil(outstanding * (1 - maxBps / 10000)),
    max_incentive_bps: maxBps, fee_basis_confirmed: false, expires_at: expiresAt,
    status: "approved", recommend_meta: { source: "auto_payment_planner", request_id: input.requestId, recommended_bps: choice.incentiveBps, reason: recommendation.reason },
  }).select("id, expires_at").single()
  if (offerError || !offer) {
    await supabase.from("auto_payment_plan_proposals").update({ status: "delivery_failed" }).eq("payment_plan_request_id", input.requestId)
    return { created: false, reason: "offer-failed" as const }
  }
  await supabase.from("settlement_events").insert({ offer_id: offer.id, user_id: input.userId, event: "approved", meta: { source: "auto_payment_planner", offer_cents: choice.offerCents, incentive_bps: choice.incentiveBps } })
  await supabase.from("auto_payment_plan_proposals").update({ offer_id: offer.id, offer_cents: choice.offerCents, incentive_bps: choice.incentiveBps }).eq("payment_plan_request_id", input.requestId)

  const link = `${appUrl()}/r/${signResolutionToken(offer.id, new Date(offer.expires_at).getTime())}`
  try {
    const result = await sendEmail({
      to: recipient, fromName: profile?.full_name ?? profile?.email ?? "Overdue",
      subject: `Payment proposal for invoice ${invoice.number ?? ""}`.trim(),
      html: `<p>Hello${client?.name ? ` ${escapeHtml(client.name)}` : ""},</p><p>Thank you for requesting a payment arrangement. We can offer a resolution of <strong>${escapeHtml(formatMoney(choice.offerCents, invoice.currency))}</strong> for invoice ${escapeHtml(invoice.number ?? "")}. Review the proposal and choose your next step here:</p><p><a href="${escapeHtml(link)}">Review payment proposal</a></p><p>Kind regards,<br>${escapeHtml(profile?.full_name ?? "Overdue")}</p>`,
    })
    await supabase.from("auto_payment_plan_proposals").update({ status: result.skipped ? "delivery_failed" : "sent", sent_at: result.skipped ? null : new Date().toISOString() }).eq("payment_plan_request_id", input.requestId)
    if (!result.skipped) await supabase.from("settlement_offers").update({ status: "sent", delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", offer.id)
  } catch {
    await supabase.from("auto_payment_plan_proposals").update({ status: "delivery_failed" }).eq("payment_plan_request_id", input.requestId)
  }
  await supabase.from("payment_plan_requests").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", input.requestId).eq("status", "open")
  return { created: true, offerCents: choice.offerCents, currency: invoice.currency }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;")
}
