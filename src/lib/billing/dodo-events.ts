/**
 * Applies a verified Dodo Payments webhook event to the local subscriptions
 * table. Extracted from the route handler so it can be unit-tested directly.
 *
 * Dodo sends Standard-Webhooks events: { type, data, timestamp }. data is the
 * full Subscription/Payment/Refund object from the Dodo API (see
 * node_modules/dodopayments resources), so we read ids, product + lifecycle
 * fields straight off it.
 */
import { mapDodoStatus, isProProductId } from "@/lib/dodo/helpers"

export interface DodoEventData {
  subscription_id?: string | null
  payment_id?: string | null
  product_id?: string | null
  status?: string | null
  next_billing_date?: string | null
  expires_at?: string | null
  cancel_at_next_billing_date?: boolean | null
  customer?: { customer_id?: string; email?: string; name?: string } | null
  metadata?: Record<string, unknown>
}

async function currentRow(supabase: any, userId: string): Promise<{ plan: string } | null> {
  if (!userId) return null
  const { data } = await supabase.from("subscriptions").select("plan").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  return (data as { plan?: string } | null) as { plan: string } | null
}

async function attachIds(
  supabase: any,
  userId: string,
  ids: { dodo_subscription_id?: string | null; dodo_customer_id?: string | null; product_id?: string | null },
) {
  const patch: Record<string, string> = {}
  if (ids.dodo_subscription_id) patch.dodo_subscription_id = ids.dodo_subscription_id
  if (ids.dodo_customer_id) patch.dodo_customer_id = ids.dodo_customer_id
  if (ids.product_id) patch.product_id = ids.product_id
  if (Object.keys(patch).length === 0) return
  await supabase
    .from("subscriptions")
    .update(patch)
    .eq("user_id", userId)
    .is("dodo_subscription_id", null)
}

export async function applyDodoEvent(
  supabase: any,
  userId: string,
  eventType: string,
  data: DodoEventData,
) {
  const subId = data?.subscription_id ? String(data.subscription_id) : ""
  const customerId =
    data?.customer?.customer_id !== undefined && data?.customer?.customer_id !== null
      ? String(data.customer.customer_id)
      : null
  const productId = data?.product_id !== undefined && data?.product_id !== null ? String(data.product_id) : null
  const periodEnd = data?.next_billing_date ?? data?.expires_at ?? null

  switch (eventType) {
    case "subscription.active":
    case "subscription.updated":
    case "subscription.plan_changed":
    case "subscription.unpaused":
    case "subscription.update_payment_method": {
      const verdict = isProProductId(productId)
      const plan =
        verdict === null ? ((await currentRow(supabase, userId))?.plan ?? "free") : verdict ? "pro" : "free"
      const status = mapDodoStatus(String(data?.status ?? "active"))

      if (subId) {
        await attachIds(supabase, userId, { dodo_subscription_id: subId, dodo_customer_id: customerId, product_id: productId })
        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            dodo_subscription_id: subId || null,
            dodo_customer_id: customerId,
            product_id: productId,
            plan,
            status,
            current_period_end: periodEnd,
          },
          { onConflict: "dodo_subscription_id" },
        )
        // Re-subscribing after a previous Dodo sub would otherwise insert a
        // second row (new dodo_subscription_id ≠ the old row's id), which
        // breaks plan gating (getPlan assumes a single row per user). Keep the
        // current subscription's row and drop any sibling rows (old sub ids,
        // or the free trigger placeholder that never got a Dodo id).
        await supabase
          .from("subscriptions")
          .delete()
          .eq("user_id", userId)
          .or(`dodo_subscription_id.is.null,dodo_subscription_id.neq.${subId}`)
      } else {
        await supabase
          .from("subscriptions")
          .update({ plan, status, dodo_customer_id: customerId ?? undefined, current_period_end: periodEnd })
          .eq("user_id", userId)
      }
      return eventType
    }

    case "subscription.paused": {
      await supabase
        .from("subscriptions")
        .update({ status: "paused", dodo_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.on_hold": {
      await supabase
        .from("subscriptions")
        .update({ status: "on_hold", dodo_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.past_due": {
      await supabase
        .from("subscriptions")
        .update({ status: "past_due", dodo_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.cancelled": {
      // Grace: with cancel_at_next_billing_date, Dodo keeps it usable until
      // next_billing_date. Store the date so getPlan() keeps Pro until expiry,
      // then subscriptions.expired flips it to free.
      if (data?.cancel_at_next_billing_date) {
        await supabase
          .from("subscriptions")
          .update({ status: "cancelled", current_period_end: periodEnd })
          .eq("user_id", userId)
      } else {
        await supabase.from("subscriptions").update({ plan: "free", status: "cancelled" }).eq("user_id", userId)
      }
      return eventType
    }

    case "subscription.failed": {
      await supabase
        .from("subscriptions")
        .update({ plan: "free", status: "failed", current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.expired": {
      await supabase
        .from("subscriptions")
        .update({ plan: "free", status: "expired", current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "subscription.renewed":
    case "payment.succeeded": {
      // Renewal paid: never downgrade. Upgrade to pro when the product matches.
      const verdict = isProProductId(productId)
      const existing = await currentRow(supabase, userId)
      const plan = verdict === true ? "pro" : (existing?.plan ?? "pro")
      if (subId) await attachIds(supabase, userId, { dodo_subscription_id: subId, dodo_customer_id: customerId, product_id: productId })
      await supabase
        .from("subscriptions")
        .update({ plan, status: "active", dodo_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "payment.failed": {
      // Renewal attempt failed; subscription.past_due/on_hold carries the truth.
      await supabase
        .from("subscriptions")
        .update({ status: "past_due", dodo_customer_id: customerId ?? undefined, current_period_end: periodEnd })
        .eq("user_id", userId)
      return eventType
    }

    case "refund.succeeded": {
      // Single-plan product: any refund ends Pro.
      await supabase.from("subscriptions").update({ plan: "free", status: "cancelled" }).eq("user_id", userId)
      return eventType
    }

    default:
      return "unhandled"
  }
}