import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import { appUrl } from "@/lib/integrations/oauth"
import { daysOverdue, defaultExpiry, recommendSettlement } from "@/lib/recovery/settlement"
import { signResolutionToken } from "@/lib/recovery/token"

export const dynamic = "force-dynamic"

/**
 * Owner approves a settlement offer (manual approval always in V1).
 * Creates the offer row, cancels superseded ones, returns the shareable
 * resolution link. Payment still moves over the invoice's existing
 * payment_url / provider — acceptance is a tracked commitment, not a charge.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`settlement:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  let body: {
    invoiceId?: unknown
    offerCents?: unknown
    basis?: unknown
    minAcceptableCents?: unknown
    maxIncentiveBps?: unknown
    feeBasisConfirmed?: unknown
    expiresAt?: unknown
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 })
  }
  if (typeof body.invoiceId !== "string" || !body.invoiceId) {
    return NextResponse.json({ ok: false, error: "invoiceId required" }, { status: 400 })
  }
  const offerCents = typeof body.offerCents === "number" ? Math.round(body.offerCents) : NaN
  if (!Number.isFinite(offerCents) || offerCents <= 0) {
    return NextResponse.json({ ok: false, error: "offerCents must be a positive amount" }, { status: 400 })
  }
  const basis = body.basis === "fee_waiver" ? "fee_waiver" : "discount"
  if (basis === "fee_waiver" && body.feeBasisConfirmed !== true) {
    return NextResponse.json(
      { ok: false, error: "fee waivers need explicit confirmation that the fee basis exists in your terms" },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, amount_cents, paid_cents, currency, due_date, status, paid_at, client_id, number, payment_url")
    .eq("id", body.invoiceId)
    .eq("user_id", user!.id)
    .single()
  if (!invoice) return NextResponse.json({ ok: false, error: "invoice not found" }, { status: 404 })
  if (invoice.status === "paid" || invoice.paid_at) {
    return NextResponse.json({ ok: false, error: "invoice already paid" }, { status: 400 })
  }

  const outstanding = Math.max(0, (invoice.amount_cents ?? 0) - (invoice.paid_cents ?? 0))
  if (offerCents > outstanding) {
    return NextResponse.json({ ok: false, error: "offer cannot exceed the outstanding balance" }, { status: 400 })
  }
  const minAcceptableCents =
    typeof body.minAcceptableCents === "number" && Number.isFinite(body.minAcceptableCents)
      ? Math.max(0, Math.round(body.minAcceptableCents))
      : null
  if (minAcceptableCents !== null && offerCents < minAcceptableCents) {
    return NextResponse.json({ ok: false, error: "offer is below your minimum acceptable recovery" }, { status: 400 })
  }
  const incentiveCents = outstanding - offerCents
  const maxBps =
    typeof body.maxIncentiveBps === "number" && Number.isFinite(body.maxIncentiveBps)
      ? Math.max(0, Math.min(2000, Math.round(body.maxIncentiveBps)))
      : 500
  if (incentiveCents > Math.round((outstanding * maxBps) / 10000)) {
    return NextResponse.json({ ok: false, error: "offer exceeds your maximum incentive" }, { status: 400 })
  }

  let expiresAt = typeof body.expiresAt === "string" ? body.expiresAt : defaultExpiry()
  if (Number.isNaN(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "expiresAt must be a future time" }, { status: 400 })
  }
  // Cap offer windows at 14 days — urgency must be real and short.
  if (new Date(expiresAt).getTime() - Date.now() > 14 * 86400000) {
    expiresAt = new Date(Date.now() + 14 * 86400000).toISOString()
  }

  let avgLateDays: number | null = null
  if (invoice.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("avg_payment_days")
      .eq("id", invoice.client_id)
      .eq("user_id", user!.id)
      .single()
    if (typeof client?.avg_payment_days === "number") avgLateDays = client.avg_payment_days
  }
  const snapshot = recommendSettlement({
    outstandingCents: outstanding,
    daysOverdue: daysOverdue(invoice.due_date),
    history: { avgLateDays, openRate: null, disputeRate: null },
    minAcceptableCents,
    maxIncentiveBps: maxBps,
  })

  // Supersede prior open offers for this invoice — one live offer at a time.
  await supabase
    .from("settlement_offers")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("user_id", user!.id)
    .eq("invoice_id", invoice.id)
    .in("status", ["approved", "sent"]);

  const { data: offer, error: insErr } = await supabase
    .from("settlement_offers")
    .insert({
      user_id: user!.id,
      invoice_id: invoice.id,
      outstanding_cents: outstanding,
      offer_cents: offerCents,
      incentive_cents: incentiveCents,
      basis,
      min_acceptable_cents: minAcceptableCents,
      max_incentive_bps: maxBps,
      fee_basis_confirmed: basis === "fee_waiver",
      expires_at: expiresAt,
      status: "approved",
      recommend_meta: {
        recommended_bps: snapshot.recommended.incentiveBps,
        reason: snapshot.reason,
      },
    })
    .select("id, expires_at")
    .single()
  if (insErr || !offer) {
    return NextResponse.json({ ok: false, error: "couldn't create offer" }, { status: 500 })
  }

  await supabase.from("settlement_events").insert({
    offer_id: offer.id,
    user_id: user!.id,
    event: "approved",
    meta: { offer_cents: offerCents, basis },
  })

  const token = signResolutionToken(offer.id, new Date(offer.expires_at).getTime())
  return NextResponse.json({
    ok: true,
    offerId: offer.id,
    link: `${appUrl()}/r/${token}`,
    expiresAt: offer.expires_at,
  })
}
