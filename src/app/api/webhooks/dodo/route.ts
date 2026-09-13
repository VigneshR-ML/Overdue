import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyDodoSignature } from "@/lib/dodo/helpers"
import { applyDodoEvent, type DodoEventData } from "@/lib/billing/dodo-events"

export const dynamic = "force-dynamic"

/**
 * Dodo Payments webhook (Standard Webhooks). Verifies the webhook-signature
 * HMAC-SHA256 over "webhook-id.webhook-timestamp.rawBody", then keeps the
 * local `subscriptions` row in sync for the subscription lifecycle + renewals.
 * Dodo retries non-2xx, so unknown/unresolved events return 200 (stop
 * retrying); only our own write failures return 500.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const headers = {
    id: request.headers.get("webhook-id") ?? undefined,
    timestamp: request.headers.get("webhook-timestamp") ?? undefined,
    signature: request.headers.get("webhook-signature") ?? undefined,
  }
  if (!verifyDodoSignature(headers, rawBody)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }
  // The webhook-id header is the per-delivery id Standard Webhooks sends —
  // the same id the signature was computed over, so it's the idempotency key.
  const deliveryId = headers["id"]!

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  let event: { type?: string; data?: DodoEventData }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }

  const eventType = event?.type ?? ""
  const data = (event?.data ?? {}) as DodoEventData
  if (!eventType) {
    return NextResponse.json({ ok: true, skipped: "no event" })
  }

  // Idempotency: the delivery id is unique per attempt; fall back to a stable
  // event+object key so redeliveries can't double-apply.
  const objectId = data.subscription_id ?? data.payment_id ?? ""
  const eventId = deliveryId || `${eventType}:${objectId}`
  const { data: already } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "dodo")
    .eq("event_id", eventId)
    .maybeSingle()
  if (already) return NextResponse.json({ ok: true, duplicate: true })

  const record = async () => {
    try {
      await supabase.from("webhook_events").insert({
        provider: "dodo",
        event_id: eventId,
        payload: event,
      })
    } catch {
      // duplicate — already handled concurrently
    }
  }

  // Resolve the user that owns this event:
  //  1. metadata.app_user_id (set via checkout metadata)
  //  2. customer email on the event
  //  3. dodo_customer_id already stored against a local subscriptions row
  const metadata = (data.metadata ?? (data as any).customer?.metadata ?? {}) as Record<string, unknown>
  let resolvedUserId: string | null =
    typeof metadata.app_user_id === "string" && metadata.app_user_id ? metadata.app_user_id : null
  const email = data.customer?.email ? String(data.customer.email).toLowerCase() : null
  if (!resolvedUserId && email) {
    const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle()
    resolvedUserId = (profile as { id?: string } | null)?.id ?? null
  }
  const customerId = data.customer?.customer_id ? String(data.customer.customer_id) : null
  if (!resolvedUserId && customerId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("dodo_customer_id", customerId)
      .maybeSingle()
    resolvedUserId = (sub as { user_id?: string } | null)?.user_id ?? null
  }
  if (!resolvedUserId) {
    await record()
    return NextResponse.json({ ok: true, unresolved: true })
  }

  const handled = await applyDodoEvent(supabase, resolvedUserId, eventType, data)
  await record()

  return NextResponse.json({ ok: true, handled })
}