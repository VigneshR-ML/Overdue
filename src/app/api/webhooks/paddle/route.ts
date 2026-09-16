import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPaddleWebhook } from "@/lib/paddle/server"
import { applyPaddleEvent, type PaddleEventData } from "@/lib/billing/paddle-events"

export const dynamic = "force-dynamic"

/**
 * Paddle webhook (primary merchant of record). Verifies the paddle-signature
 * HMAC via the SDK, then keeps the local `subscriptions` row in sync for the
 * subscription lifecycle + renewals. Paddle retries non-2xx, so
 * unknown/unresolved events return 200 (stop retrying); only our own write
 * failures return 500.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("paddle-signature") ?? ""
  const event = (await verifyPaddleWebhook(rawBody, signature)) as {
    eventId?: string
    eventType?: string
    data?: Record<string, unknown>
  } | null
  if (!event) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const eventType = event?.eventType ?? ""
  const data = (event?.data ?? {}) as PaddleEventData
  if (!eventType) {
    return NextResponse.json({ ok: true, skipped: "no event" })
  }

  // Idempotency: Paddle's event_id is unique per event; fall back to a stable
  // event+object key so redeliveries can't double-apply.
  const objectId = data.id ?? ""
  const eventId = event?.eventId || `${eventType}:${objectId}`
  const { data: already } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "paddle")
    .eq("event_id", eventId)
    .maybeSingle()
  if (already) return NextResponse.json({ ok: true, duplicate: true })

  const record = async () => {
    try {
      await supabase.from("webhook_events").insert({
        provider: "paddle",
        event_id: eventId,
        payload: { event_id: eventId, event_type: eventType, data },
      })
    } catch {
      // duplicate — already handled concurrently
    }
  }

  // Resolve the user that owns this event:
  //  1. custom_data.app_user_id (set via checkout custom data)
  //  2. customer email on the event
  //  3. paddle_customer_id already stored against a local subscriptions row
  const customData = (data.custom_data ?? {}) as Record<string, unknown>
  let resolvedUserId: string | null =
    typeof customData.app_user_id === "string" && customData.app_user_id ? customData.app_user_id : null
  const dataAny = data as unknown as { customer?: { email?: string; id?: string } | null; customer_id?: string }
  const email = dataAny.customer?.email ? String(dataAny.customer.email).toLowerCase() : null
  if (!resolvedUserId && email) {
    const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle()
    resolvedUserId = (profile as { id?: string } | null)?.id ?? null
  }
  const customerId = data.customer_id
    ? String(data.customer_id)
    : dataAny.customer?.id
      ? String(dataAny.customer.id)
      : null
  if (!resolvedUserId && customerId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_customer_id", customerId)
      .maybeSingle()
    resolvedUserId = (sub as { user_id?: string } | null)?.user_id ?? null
  }
  if (!resolvedUserId) {
    await record()
    return NextResponse.json({ ok: true, unresolved: true })
  }

  const handled = await applyPaddleEvent(supabase, resolvedUserId, eventType, data)
  await record()

  return NextResponse.json({ ok: true, handled })
}
