/** Canonical, fail-closed Pro entitlement resolution. */
export type Plan = "free" | "pro"

export interface SubscriptionLike {
  plan?: string | null
  status?: string | null
  current_period_end?: string | null
}

/** End of the verified paid-through window (ms), or 0 if missing/invalid. */
export function graceUntil(sub: SubscriptionLike | null | undefined, _now: number = Date.now()): number {
  if (!sub?.current_period_end) return 0
  const time = new Date(sub.current_period_end).getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * Never grant Pro for unknown statuses or an indefinitely unpaid retry state.
 * Active and trialing grants depend on provider-verified records written by
 * the billing webhook, not on a client-supplied plan value. The database must
 * separately protect subscription writes and verify provider event identity.
 */
export function planForSubscription(
  sub: SubscriptionLike | null | undefined,
  now: number = Date.now(),
): Plan {
  if (!sub || sub.plan !== "pro") return "free"
  const status = (sub.status ?? "").toLowerCase()
  if (status === "active" || status === "trialing") return "pro"
  if (["cancelled", "past_due", "paused", "on_hold"].includes(status)) {
    return graceUntil(sub, now) > now ? "pro" : "free"
  }
  return "free"
}
