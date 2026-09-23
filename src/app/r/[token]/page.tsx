import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyResolutionToken } from "@/lib/recovery/token"
import { ResolutionView, type PublicOffer } from "@/components/settlements/resolution-view"
import { Wordmark } from "@/components/marketing/site"
import { daysOverdue } from "@/lib/utils/format"

export const dynamic = "force-dynamic"

export const metadata = { title: "Resolve invoice", robots: { index: false, follow: false } }

export default async function ResolutionPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const verified = verifyResolutionToken(params.token)
  if (!verified) notFound()

  const supabase = createAdminClient()
  if (!supabase) notFound()

  const { data: offer } = await supabase
    .from("settlement_offers")
    .select("id, user_id, invoice_id, outstanding_cents, offer_cents, incentive_cents, basis, expires_at, status, settlement_payment_url")
    .eq("id", verified.offerId)
    .single()
  if (!offer) notFound()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("number, currency, due_date, status, paid_at")
    .eq("id", (offer as { invoice_id: string }).invoice_id)
    .single()
  if (!invoice) notFound()
  if ((invoice as { status: string }).status === "paid" || (invoice as { paid_at: string | null }).paid_at) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-5">
        <div className="w-full max-w-md rounded-lg border border-moss/40 bg-moss-soft p-6 text-center">
          <div className="mb-4 flex justify-center"><Wordmark /></div>
          <p className="font-display text-xl text-ink">Already paid — thank you.</p>
        </div>
      </div>
    )
  }

  const { data: proposedPlan } = await supabase
    .from("payment_plans")
    .select("id, status, total_cents, currency, frequency, starts_on, installment_count, plan_installments(amount_cents, due_date, status)")
    .eq("invoice_id", (offer as { invoice_id: string }).invoice_id)
    .eq("status", "proposed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", (offer as { user_id: string }).user_id)
    .single()

  const o = offer as {
    id: string
    user_id: string
    outstanding_cents: number
    offer_cents: number
    incentive_cents: number
    basis: "discount" | "fee_waiver"
    expires_at: string
    status: string
    settlement_payment_url: string | null
  }
  const inv = invoice as {
    number: string | null
    currency: string
    due_date: string | null
  }

  // Record the view (best-effort, never blocks rendering). The offer's
  // "sent" transition happens only when a reminder actually goes out (dispatch
  // stamps delivered_at) — opening the link is a VIEW, not a send, so it must
  // never fake delivery signals.
  try {
    await supabase
      .from("settlement_offers")
      .update({ viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", o.id)
      .is("viewed_at", null)
    await supabase
      .from("settlement_events")
      .insert({ offer_id: o.id, user_id: o.user_id, event: "viewed", meta: {} })
  } catch {
    // best-effort
  }

  const pub: PublicOffer = {
    token: params.token,
    invoiceNumber: inv.number,
    businessName: (profile as { full_name?: string | null } | null)?.full_name ?? "The business",
    currency: (inv.currency ?? "USD").toUpperCase(),
    outstandingCents: o.outstanding_cents,
    offerCents: o.offer_cents,
    incentiveCents: o.incentive_cents,
    basis: o.basis,
    expiresAt: o.expires_at,
    status: o.status,
    paymentUrl: typeof offer.settlement_payment_url === "string" ? offer.settlement_payment_url : null,
    daysOverdue: Math.max(0, daysOverdue(inv.due_date)),
    proposedPlan: proposedPlan ? {
      id: proposedPlan.id,
      totalCents: Number(proposedPlan.total_cents),
      currency: String(proposedPlan.currency ?? inv.currency).toUpperCase(),
      frequency: String(proposedPlan.frequency),
      startsOn: String(proposedPlan.starts_on),
      installmentCount: Number(proposedPlan.installment_count),
      installments: (proposedPlan.plan_installments ?? []).map((row: { amount_cents: number; due_date: string; status: string }) => ({
        amountCents: Number(row.amount_cents), dueDate: row.due_date, status: row.status,
      })),
    } : null,
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-md items-center px-5">
          <Wordmark />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-5 py-10">
        <ResolutionView offer={pub} />
      </main>
    </div>
  )
}
