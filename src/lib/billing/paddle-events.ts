/**
 * Applies a verified Paddle webhook event to the local subscriptions table.
 * Extracted from the route handler so it can be unit-tested directly.
 *
 * Paddle sends events: { event_id, event_type, data }. data is the full
 * Subscription/Transaction object from the Paddle API, so we read ids,
 * price + lifecycle fields straight off it.
 */
import { mapPaddleStatus, isProPriceId } from "@/lib/paddle/helpers"

export interface PaddleEventData {
  id?: string | null
  customer_id?: string | null
  status?: string | null
  custom_data?: Record<string, unknown> | null
  customer?: { id?: string; email?: string } | null
  items?: Array<{ price?: { id?: string } }> | null
  current_billing_period?: { ends_at?: string | null } | null
  next_billing_period?: { starts_at?: string | null } | null
  canceled_at?: string | null
  paused_at?: string | null
}

async function currentRow(supabase: any, userId: string): Promise<{ plan: string } | null> {
  if (!userId) return null
  const { data } = await supabase.from("subscriptions").select("plan").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  return (data as { plan?: string } | null) as { plan: string } | null
}

function priceIdFrom(data: PaddleEventData): string | null {
  const first = data?.items?.[0]?.price?.id
  return first !== undefined && first !== null ? String(first) : null
}

async function attachIds(
  supabase: any,
  userId: string,
  ids: { paddle_subscription_id?: string | null; paddle_customer_id?: string | null; product_id?: string | null },
) {
  const patch: Record<string, string> = {}
  if (ids.paddle_subscription_id) patch.paddle_subscription_id = ids.paddle_subscription_id
  if (ids.paddle_customer_id) patch.paddle_customer_id = ids.paddle_customer_id
  if (ids.product_id) patch.product_id = ids.product_id
  patch.billing_provider = "paddle"
  if (Object.keys(patch).length === 0) return
  await supabase
    .from("subscriptions")
    .update(patch)
    .eq("user_id", userId)
    .is("paddle_subscription_id", null)
}

export async function applyPaddleEvent(
  supabase: any,
  userId: string,
  eventType: string,
  data: PaddleEventData,
) {
  const subId = data?.id ? String(data.id) : ""
  const customerId =
    data?.customer_id !== undefined && data?.customer_id !== null
      ? String(data.customer_id)
      : data?.customer?.id
        ? String(data.customer.id)
        : null
  const priceId = priceIdFrom(data)
  const periodEnd = data?.current_billing_period?.ends_at ?? data?.next_billing_period?.starts_at ?? null

  switch (eventType) {
    case "subscription.created":
    case "subscription.updated":
    case "subscription.activated":
    case "subscription.resumed": {
      const verdict = isProPriceId(priceId)
      const plan =
        verdict === null ? ((await currentRow(supabase, userId))?.plan ?? "free") : verdict ? "pro" : "free"
      const status = mapPaddleStatus(String(data?.status ?? "active"))

      if (subId) {
        await attachIds(supabase, userId, { paddle_subscription_id: subId, paddle_customer_id: customerId, product_id: priceId })
        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            paddle_subscription_id: subId || null,
            paddle_customer_id: customerId,
            product_id: priceId,
            billing_provider: "paddle",
            plan,
            status,
            current_period_end: periodEnd,
          },
          { onConflict: "paddle_subscription_id" },
        )
        // Re-subscribing after a previous Paddle sub would otherwise insert a
        // second row (new paddle_subscription_id ≠ the old row's id), which
        // breaks plan gating (getPlan assumes a single row per user). Keep the
        // current subscription's row and drop any sibling rows (old sub ids,
        // or the free trigger placeholder that never got a Paddle id).
        await supabase
          .from("subscriptions")
          .delete()
          .eq("user_id", userId)
          .or(`paddle_subscription_id.is.null,paddle_subscription_id.neq.${subId}`)
      } else {
        await supabase
          .from("subscriptions")
          .update({ plan, status, paddle_customer_id: customerId ?? undefined, current_period_end: periodEnd, billing_provider: "paddle" })
          .eq("user_id", userId)
      }
      return eventType
    }

    case "subscription.paused": {
      await supabase
        .from("subscriptions")
        .update({ status: "paused", paddle_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.past_due": {
      await supabase
        .from("subscriptions")
        .update({ status: "past_due", paddle_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.canceled": {
      // Grace: Paddle keeps canceled-at-period-end usable until the period
      // ends. Store the date so getPlan() keeps Pro until expiry.
      if (data?.canceled_at && periodEnd) {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", current_period_end: periodEnd })
          .eq("user_id", userId)
      } else {
        await supabase.from("subscriptions").update({ plan: "free", status: "cancelled" }).eq("user_id", userId)
      }
      return eventType
    }

    case "subscription.trialing": {
      const verdict = isProPriceId(priceId)
      const plan = verdict === true ? "pro" : ((await currentRow(supabase, userId))?.plan ?? "free")
      if (subId) await attachIds(supabase, userId, { paddle_subscription_id: subId, paddle_customer_id: customerId, product_id: priceId })
      await supabase
        .from("subscriptions")
        .update({ plan, status: "active", paddle_customer_id: customerId ?? undefined, current_period_end: periodEnd, billing_provider: "paddle" })
        .eq("user_id", userId)
      return eventType
    }

    case "transaction.completed":
    case "transaction.paid": {
      // Renewal paid: never downgrade. Upgrade to pro when the price matches.
      const verdict = isProPriceId(priceId)
      const existing = await currentRow(supabase, userId)
      const plan = verdict === true ? "pro" : (existing?.plan ?? "pro")
      if (subId) await attachIds(supabase, userId, { paddle_subscription_id: subId, paddle_customer_id: customerId, product_id: priceId })
      await supabase
        .from("subscriptions")
        .update({ plan, status: "active", paddle_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "transaction.failed":
    case "transaction.payment_failed": {
      // Renewal attempt failed; subscription.past_due carries the truth.
      await supabase
        .from("subscriptions")
        .update({ status: "past_due", paddle_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.trashed": {
      await supabase.from("subscriptions").update({ plan: "free", status: "expired" }).eq("user_id", userId)
      return eventType
    }

    default:
      return "unhandled"
  }
}
