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
  subscription_id?: string | null
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
  const { data } = await supabase.from("subscriptions").select("plan").eq("user_id", userId).maybeSingle()
  return (data as { plan?: string } | null) as { plan: string } | null
}

function priceIdFrom(data: PaddleEventData): string | null {
  const first = data?.items?.[0]?.price?.id
  return first !== undefined && first !== null ? String(first) : null
}

/**
 * Writes the single subscription row for this user. The subscriptions table is
 * one-row-per-user (unique index on user_id, migration 0018) — every Paddle
 * lifecycle event upserts that row rather than racing sibling rows, so a
 * re-subscribe can never leave a stale placeholder that wrong-legs plan gating.
 */
async function upsertRow(
  supabase: any,
  userId: string,
  patch: Record<string, unknown>,
) {
  await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, ...patch, billing_provider: "paddle" }, { onConflict: "user_id" })
}

export async function applyPaddleEvent(
  supabase: any,
  userId: string,
  eventType: string,
  data: PaddleEventData,
) {
  // (D15) Subscription events identify by data.id; transaction events by
  // data.subscription_id (data.id there is the TRANSACTION id — using it as a
  // subscription id attached a new paddle_subscription_id on renewals and could
  // leave the row pointing at the wrong subscription).
  const subId = data?.subscription_id
    ? String(data.subscription_id)
    : data?.id
      ? String(data.id)
      : ""
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

      await upsertRow(supabase, userId, {
        paddle_subscription_id: subId || null,
        paddle_customer_id: customerId,
        product_id: priceId,
        plan,
        status,
        current_period_end: periodEnd,
      })
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
      await upsertRow(supabase, userId, {
        paddle_subscription_id: subId || null,
        paddle_customer_id: customerId,
        product_id: priceId,
        plan,
        status: "active",
        current_period_end: periodEnd,
      })
      return eventType
    }

    case "transaction.completed":
    case "transaction.paid": {
      // Renewal paid: never downgrade. Upgrade to pro when the price matches;
      // an unknown/missing product with no existing grant defaults to FREE —
      // never invent pro access from an unrelated transaction.
      const verdict = isProPriceId(priceId)
      const existing = await currentRow(supabase, userId)
      const plan = verdict === true ? "pro" : (existing?.plan ?? "free")
      await upsertRow(supabase, userId, {
        paddle_subscription_id: subId || null,
        paddle_customer_id: customerId,
        product_id: priceId,
        plan,
        status: "active",
        current_period_end: periodEnd,
      })
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
