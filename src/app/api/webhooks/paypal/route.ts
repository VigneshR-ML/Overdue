import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPaypalWebhook, markInvoicePaid, alreadyHandled, recordEvent } from "@/lib/integrations/paid-webhooks"

export const dynamic = "force-dynamic"

/**
 * PayPal webhook (real-time paid detection). PayPal signs with rotating certs,
 * so verification is a server-to-server API call, not a local HMAC — needs
 * PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET + PAYPAL_WEBHOOK_ID. Subscribe to
 * INVOICING.INVOICE.PAID in PayPal dashboard → Notifications → Webhooks with
 * URL https://<app>/api/webhooks/paypal.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  const verified = await verifyPaypalWebhook({
    transmissionId: request.headers.get("paypal-transmission-id") ?? "",
    transmissionTime: request.headers.get("paypal-transmission-time") ?? "",
    certUrl: request.headers.get("paypal-cert-url") ?? "",
    authAlgo: request.headers.get("paypal-auth-algo") ?? "",
    transmissionSig: request.headers.get("paypal-transmission-sig") ?? "",
    webhookEvent: event,
  })
  if (!verified) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const eventId = event.id ?? ""
  if (!eventId) {
    console.error("[paypal-webhook] event missing id — rejecting:", event.event_type)
    return NextResponse.json({ ok: false, error: "event id required" }, { status: 400 })
  }
  if (await alreadyHandled(supabase, "paypal", eventId)) {
    return NextResponse.json({ ok: true, duplicate: true })
  }

  let handled = "unhandled"
  let flipped = 0
  if (event.event_type === "INVOICING.INVOICE.PAID") {
    const invoiceId = event.resource?.invoice?.id ?? event.resource?.id ?? ""
    flipped = await markInvoicePaid(supabase, "paypal", invoiceId)
    handled = event.event_type
  }
  await recordEvent(supabase, "paypal", eventId, event)
  return NextResponse.json({ ok: true, handled, flipped })
}
