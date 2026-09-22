import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import { verifyResolutionToken } from "@/lib/recovery/token"

export const dynamic = "force-dynamic"

/**
 * An invoice's payment_url does NOT prove it charges the accepted settlement
 * amount. Fail closed until a provider-specific discounted checkout has been
 * created and its exact amount/currency independently verified server-side.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const rl = await rateLimit(
    `pay:${request.headers.get("x-forwarded-for") ?? "anon"}`,
    RATE_LIMITS.api.limit,
    RATE_LIMITS.api.windowMs,
  )
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const verified = verifyResolutionToken(params.token)
  if (!verified) return NextResponse.json({ ok: false, error: "invalid link" }, { status: 404 })

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const { data: offer, error: offerError } = await supabase
    .from("settlement_offers")
    .select("id, user_id, invoice_id, offer_cents, status, expires_at")
    .eq("id", verified.offerId)
    .single()
  if (offerError || !offer) return NextResponse.json({ ok: false, error: "offer not found" }, { status: 404 })

  if (offer.status === "paid") {
    return NextResponse.json({ ok: false, error: "This offer is already paid." }, { status: 409 })
  }
  if (new Date(offer.expires_at as string).getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "This offer has expired. Contact the business for updated terms." }, { status: 410 })
  }
  if (offer.status !== "accepted") {
    return NextResponse.json({ ok: false, error: "accept the offer before paying" }, { status: 400 })
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("currency")
    .eq("id", offer.invoice_id as string)
    .eq("user_id", offer.user_id as string)
    .single()
  if (invoiceError || !invoice) {
    return NextResponse.json({ ok: false, error: "invoice unavailable" }, { status: 404 })
  }

  const offerCents = Number(offer.offer_cents)
  if (!Number.isSafeInteger(offerCents) || offerCents <= 0) {
    return NextResponse.json({ ok: false, error: "invalid offer amount" }, { status: 409 })
  }

  // This is a request for payment instructions, not evidence of a payment.
  // Do not return invoice.payment_url: it may charge the undiscounted amount.
  const { error: eventError } = await supabase.from("settlement_events").insert({
    offer_id: offer.id,
    user_id: offer.user_id,
    event: "viewed",
    meta: { action: "discounted_payment_requested", checkout_available: false },
  })
  if (eventError) {
    return NextResponse.json({ ok: false, error: "Unable to record payment request. Please retry." }, { status: 503 })
  }

  return NextResponse.json({
    ok: false,
    no_payment_url: true,
    offer_cents: offerCents,
    currency: String(invoice.currency || "USD").toUpperCase(),
    error: "Online payment for this discounted offer is not available yet. Contact the business for a payment link that charges the agreed amount. No payment has been taken.",
  }, { status: 409 })
}
