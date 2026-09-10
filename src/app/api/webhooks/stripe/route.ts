import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyStripeSignature, markInvoicePaid, alreadyHandled, recordEvent } from "@/lib/integrations/paid-webhooks"

export const dynamic = "force-dynamic"

const PAID_TYPES = new Set(["invoice.paid", "invoice.payment_succeeded"])

/**
 * Stripe Connect webhook (real-time paid detection). The hourly sync already
 * picks up payments; this flips the invoice to paid within seconds so the
 * dispatcher never sends another rung. Configure in Stripe dashboard →
 * Developers → Webhooks → endpoint https://<app>/api/webhooks/stripe with
 * events invoice.paid (and invoice.payment_succeeded for legacy).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature") ?? ""
  if (!verifyStripeSignature(signature, rawBody)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  const eventId = event.id ?? ""
  if (await alreadyHandled(supabase, "stripe", eventId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  let handled = "unhandled"
  let flipped = 0
  if (PAID_TYPES.has(event.type)) {
    const invoiceId = event.data?.object?.id ?? ""
    flipped = await markInvoicePaid(supabase, "stripe", invoiceId)
    handled = event.type
  }
  await recordEvent(supabase, "stripe", eventId, event)
  return NextResponse.json({ ok: true, handled, flipped })
}
