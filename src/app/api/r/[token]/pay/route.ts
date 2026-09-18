import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"
import { verifyResolutionToken } from "@/lib/recovery/token"

export const dynamic = "force-dynamic"

/**
 * (D03) Payment intent for an accepted settlement offer.
 *
 * The accepted offer is a discounted amount; the invoice's payment_url is for
 * the FULL amount. Providers' hosted checkouts can't mint a discounted link for
 * the invoice's own payment_url, so we serve the pay action server-side: the
 * debtor is always told the exact discounted amount owed, the click is recorded
 * (owner sees + can send a discounted invoice), and when no payment_url exists
 * yet the debtor gets a clear "the business will send a link" response instead
 * of silently redirecting to a full-price page.
 */
export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const rl = rateLimit(
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

  const { data: offer } = await supabase
    .from("settlement_offers")
    .select("id, user_id, invoice_id, offer_cents, status, expires_at")
    .eq("id", verified.offerId)
    .single()
  if (!offer) return NextResponse.json({ ok: false, error: "offer not found" }, { status: 404 })

  const userId = offer.user_id as string
  const expired = new Date(offer.expires_at as string).getTime() <= Date.now()
  if (expired && offer.status !== "paid") {
    return NextResponse.json({ ok: false, error: "offer expired — the full balance applies" }, { status: 410 })
  }
  if (!["accepted", "paid"].includes(offer.status as string)) {
    return NextResponse.json({ ok: false, error: "accept the offer before paying" }, { status: 400 })
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("payment_url, currency")
    .eq("id", offer.invoice_id as string)
    .single()
  const payUrl = (invoice as { payment_url?: string | null } | null)?.payment_url ?? null
  const currency = ((invoice as { currency?: string | null } | null)?.currency || "USD").toUpperCase()
  const offerCents = Number(offer.offer_cents ?? 0)

  // Best-effort audit trail for the owner.
  try {
    await supabase.from("settlement_events").insert({
      offer_id: offer.id,
      user_id: userId,
      event: "viewed",
      meta: { action: "pay_clicked", has_payment_url: Boolean(payUrl) },
    })
  } catch {
    // non-fatal
  }

  if (!payUrl) {
    // No payment link on the invoice: don't guess. Tell the debtor the
    // discounted amount stands and the business will send a link.
    return NextResponse.json(
      {
        ok: false,
        no_payment_url: true,
        offer_cents: offerCents,
        currency,
        error:
          "The business will send you a payment link for the discounted amount. You are not being charged the full balance.",
      },
      { status: 409 },
    )
  }

  return NextResponse.json({ ok: true, payUrl, offerCents, currency })
}