import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPaddleSignature } from "@/lib/paddle/helpers"

export const dynamic = "force-dynamic"

/**
 * Paddle Billing webhook. Verifies the HMAC signature, then keeps the local
 * `subscriptions` row in sync for subscription lifecycle + renewals.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("paddle-signature") ?? ""
  if (!verifyPaddleSignature(signature, rawBody)) {
    return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 })
  }

  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })

  const event = JSON.parse(rawBody)
  const eventType = event.event_type
  const data = event.data ?? {}

  // Idempotency ledger.
  const { data: already } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "paddle")
    .eq("event_id", event.event_id ?? "")
    .maybeSingle()
  if (already) return NextResponse.json({ ok: true, duplicate: true })

  const userId = data.custom_data?.user_id ?? data.user_id ?? null

  // Resolve the user by email when custom_data isn't present.
  let resolvedUserId: string | null = userId
  if (!resolvedUserId && data.customer?.email) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", data.customer.email)
      .maybeSingle()
    resolvedUserId = profile?.id ?? null
  }
  if (!resolvedUserId) {
    // Record event anyway for debugging; nothing to update.
    await supabase.from("webhook_events").insert({
      provider: "paddle", event_id: event.event_id ?? "", payload: event,
    })
    return NextResponse.json({ ok: true, unresolved: true })
  }

  const handled = await applyPaddleEvent(supabase, resolvedUserId, eventType, data)
  await supabase.from("webhook_events").insert({
    provider: "paddle", event_id: event.event_id ?? "", payload: event,
  })

  return NextResponse.json({ ok: true, handled })
}

async function applyPaddleEvent(supabase: any, userId: string, eventType: string, data: any) {
  const priceId = process.env.PADDLE_PRICE_PRO_MONTHLY ?? ""
  const isPro = data.items?.some?.((i: any) => i.price?.id === priceId)
  const plan = isPro ? "pro" : "free"

  const mapStatus = (raw: string) => {
    const s = raw.toLowerCase()
    if (s.includes("active")) return "active"
    if (s.includes("trialing") || s.includes("trial")) return "trialing"
    if (s.includes("paused")) return "past_due"
    if (s.includes("past_due")) return "past_due"
    if (s.includes("cancel")) return "cancelled"
    return "active"
  }

  switch (eventType) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.activated":
    case "subscription.paused":
    case "subscription.canceled":
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          paddle_subscription_id: data.id,
          paddle_customer_id: data.customer_id,
          plan,
          status: mapStatus(data.status ?? "active"),
          current_period_end: data.current_billing_period?.ends_at ?? data.current_billing_period?.end ?? null,
        },
        { onConflict: "paddle_subscription_id" },
      )
      return eventType

    case "subscription.payment_succeeded":
    case "transaction.completed":
      if (data.subscription_id) {
        await supabase
          .from("subscriptions")
          .update({ plan, status: "active", paddle_customer_id: data.customer_id ?? null })
          .eq("user_id", userId)
      } else if (data.subscription?.id) {
        await supabase
          .from("subscriptions")
          .update({ plan, status: "active" })
          .eq("user_id", userId)
      }
      return eventType

    case "subscription.cancel":
      await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", userId)
      return eventType

    default:
      return "unhandled"
  }
}