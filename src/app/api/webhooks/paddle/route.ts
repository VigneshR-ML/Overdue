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
  // The SDK unmarshals webhook JSON into camelCase entity instances
  // (customData, customerId, currentBillingPeriod…), while our billing code
  // reads Paddle's snake_case API shape. Normalize at the boundary so both
  // work — this exact mismatch silently skipped activation (events resolved
  // to no user) until it was caught from a stored payload.
  const raw = JSON.parse(JSON.stringify(event?.data ?? {})) as Record<string, any>
  const periodOf = (snake: unknown, camel: unknown): { ends_at?: string | null; starts_at?: string | null } | null => {
    if (snake && typeof snake === "object") return snake as { ends_at?: string | null; starts_at?: string | null }
    if (camel && typeof camel === "object") {
      const c = camel as Record<string, unknown>
      return { ends_at: (c.endsAt ?? c.ends_at ?? null) as string | null, starts_at: (c.startsAt ?? c.starts_at ?? null) as string | null }
    }
    return null
  }
  const data = {
    id: raw.id ?? null,
    customer_id: raw.customer_id ?? raw.customerId ?? null,
    status: raw.status ?? null,
    custom_data: raw.custom_data ?? raw.customData ?? null,
    customer: raw.customer ?? null,
    items: Array.isArray(raw.items)
      ? raw.items.map((i: { price?: { id?: unknown } | null }) => ({ price: { id: i?.price?.id ?? null } }))
      : null,
    current_billing_period: periodOf(raw.current_billing_period, raw.currentBillingPeriod),
    next_billing_period: periodOf(raw.next_billing_period, raw.nextBillingPeriod),
    canceled_at: raw.canceled_at ?? raw.canceledAt ?? null,
    paused_at: raw.paused_at ?? raw.pausedAt ?? null,
  } as PaddleEventData
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
    } catch (e) {
      // duplicate — already handled concurrently (log anything else)
      console.error("[paddle] webhook_events insert failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown")
    }
  }

  // Resolve the user that owns this event:
  //  1. custom_data.app_user_id (set via checkout custom data)
  //  2. customer email on the event
  //  3. paddle_customer_id already stored against a local subscriptions row
  const customData = (data.custom_data ?? {}) as Record<string, unknown>
  let resolvedUserId: string | null =
    typeof customData.app_user_id === "string" && customData.app_user_id ? customData.app_user_id : null
  let resolvedVia = resolvedUserId ? "custom_data" : "none"
  const dataAny = data as unknown as { customer?: { email?: string; id?: string } | null; customer_id?: string }
  const email = dataAny.customer?.email ? String(dataAny.customer.email).toLowerCase() : null
  if (!resolvedUserId && email) {
    const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle()
    resolvedUserId = (profile as { id?: string } | null)?.id ?? null
    if (resolvedUserId) resolvedVia = "email"
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
    if (resolvedUserId) resolvedVia = "stored_customer_id"
  }
  console.error(
    "[paddle] webhook resolve:",
    JSON.stringify({
      eventType,
      eventId: String(eventId).slice(0, 60),
      objectId: String(objectId).slice(0, 40),
      via: resolvedVia,
      hasCustom: Boolean(customData.app_user_id),
      emailPresent: Boolean(email),
      customerId,
      priceId: data?.items?.[0]?.price?.id ?? null,
    }),
  )
  if (!resolvedUserId) {
    await record()
    return NextResponse.json({ ok: true, unresolved: true })
  }

  const handled = await applyPaddleEvent(supabase, resolvedUserId, eventType, data)
  console.error("[paddle] webhook applied:", JSON.stringify({ eventType, eventId: String(eventId).slice(0, 60), handled }))
  await record()

  return NextResponse.json({ ok: true, handled })
}
