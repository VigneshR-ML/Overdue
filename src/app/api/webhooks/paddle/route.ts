import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyPaddleSignature } from "@/lib/paddle/helpers"
import { applyPaddleEvent } from "@/lib/billing/paddle-events"

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

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const eventType = event.event_type
  const data = event.data ?? {}

  // Reject events with missing event_id to prevent idempotency key collision
  if (!event.event_id) {
    return NextResponse.json({ ok: false, error: "event_id required" }, { status: 400 })
  }

  // Idempotency ledger.
  const { data: already } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", "paddle")
    .eq("event_id", event.event_id)
    .maybeSingle()
  if (already) return NextResponse.json({ ok: true, duplicate: true })

  const userId = data.custom_data?.user_id ?? data.user_id ?? null

  // Resolve the user that owns this event, in order of preference:
  //  1. custom_data.user_id (set via checkout customData)
  //  2. customer email on the event
  //  3. paddle_customer_id already stored against a local subscriptions row
  let resolvedUserId: string | null = userId
  if (!resolvedUserId && data.customer?.email) {
    const email = String(data.customer.email).toLowerCase()
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle()
    resolvedUserId = (profile as { id?: string } | null)?.id ?? null
  }
  if (!resolvedUserId && data.customer_id) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("paddle_customer_id", data.customer_id)
      .maybeSingle()
    resolvedUserId = (sub as { user_id?: string } | null)?.user_id ?? null
  }
  if (!resolvedUserId) {
    // Record event anyway for debugging; nothing to update.
    await supabase.from("webhook_events").insert({
      provider: "paddle", event_id: event.event_id ?? "", payload: event,
    })
    return NextResponse.json({ ok: true, unresolved: true })
  }

  // Persist the customer_id so later events (subscription.updated, renewals)
  // resolve instantly without email/custom_data matching.
  if (data.customer_id) {
    await supabase
      .from("subscriptions")
      .update({ paddle_customer_id: data.customer_id })
      .eq("user_id", resolvedUserId)
      .is("paddle_customer_id", null)
  }

  const handled = await applyPaddleEvent(supabase, resolvedUserId, eventType, data)
  if (handled !== "unhandled") {
    await supabase.from("webhook_events").insert({
      provider: "paddle", event_id: event.event_id ?? "", payload: event,
    })
  }

  return NextResponse.json({ ok: true, handled })
}