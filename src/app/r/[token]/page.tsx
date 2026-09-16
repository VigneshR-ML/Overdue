import { notFound } from "next/navigation"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyResolutionToken } from "@/lib/recovery/token"
import { ResolutionView, type PublicOffer } from "@/components/settlements/resolution-view"
import { Wordmark } from "@/components/marketing/site"

export const dynamic = "force-dynamic"

export const metadata = { title: "Resolve invoice", robots: { index: false, follow: false } }

function daysOverdue(due: string | null): number {
  if (!due) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(due + "T12:00:00").getTime()) / 86400000))
}

export default async function ResolutionPage({ params }: { params: { token: string } }) {
  const verified = verifyResolutionToken(params.token)
  if (!verified) notFound()

  const supabase = createAdminClient()
  if (!supabase) notFound()

  const { data: offer } = await supabase
    .from("settlement_offers")
    .select("id, user_id, invoice_id, outstanding_cents, offer_cents, incentive_cents, basis, expires_at, status")
    .eq("id", verified.offerId)
    .single()
  if (!offer) notFound()

  const { data: invoice } = await supabase
    .from("invoices")
    .select("number, currency, due_date, payment_url, status, paid_at")
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
  }
  const inv = invoice as {
    number: string | null
    currency: string
    due_date: string | null
    payment_url: string | null
  }

  // Record the view (best-effort, never blocks rendering).
  try {
    await supabase
      .from("settlement_offers")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", o.id)
    await supabase
      .from("settlement_events")
      .insert({ offer_id: o.id, user_id: o.user_id, event: "viewed", meta: {} })
    if (o.status === "approved") {
      await supabase
        .from("settlement_offers")
        .update({ status: "sent", updated_at: new Date().toISOString() })
        .eq("id", o.id)
    }
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
    paymentUrl: inv.payment_url,
    daysOverdue: daysOverdue(inv.due_date),
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
