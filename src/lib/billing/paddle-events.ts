/**
 * Applies a verified Paddle Billing webhook event to the local subscriptions
 * table. Extracted from the route handler so it can be unit-tested directly.
 *
 * Event types our app cares about (Paddle Billing):
 *   subscription.created / updated / activated / paused / canceled  → lifecycle
 *   transaction.completed / transaction.billed                      → renewal paid
 */
export async function applyPaddleEvent(
  supabase: any,
  userId: string,
  eventType: string,
  data: any,
) {
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
    case "subscription.canceled": {
      const subId = data.id
      const customerId = data.customer_id ?? null

      // Every user gets a default "free" subscriptions row (created by the
      // on_auth_user_created trigger) with NULL paddle ids. Attach the paddle ids
      // to that existing row first so the user keeps a single row — otherwise the
      // upsert below (keyed on paddle_subscription_id) records a duplicate.
      if (subId) {
        await supabase
          .from("subscriptions")
          .update({ paddle_subscription_id: subId, paddle_customer_id: customerId })
          .eq("user_id", userId)
          .is("paddle_subscription_id", null)
      }

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          paddle_subscription_id: subId,
          paddle_customer_id: customerId,
          plan,
          status: mapStatus(data.status ?? "active"),
          current_period_end:
            data.current_billing_period?.ends_at ??
            data.current_billing_period?.end ??
            null,
        },
        { onConflict: "paddle_subscription_id" },
      )
      return eventType
    }

    case "transaction.completed":
    case "transaction.billed": {
      // A successful renewal / initial payment. Mark the plan active for the
      // subscription that was just paid.
      const subId = data.subscription_id ?? data.subscription?.id ?? null
      if (subId) {
        await supabase
          .from("subscriptions")
          .update({
            plan,
            status: "active",
            paddle_customer_id: data.customer_id ?? null,
          })
          .eq("user_id", userId)
      }
      return eventType
    }

    case "transaction.refunded": {
      // Downgrade to free on refund.
      const subId = data.subscription_id ?? data.subscription?.id ?? null
      if (subId) {
        await supabase
          .from("subscriptions")
          .update({ plan: "free", status: "cancelled" })
          .eq("user_id", userId)
      }
      return eventType
    }

    default:
      return "unhandled"
  }
}