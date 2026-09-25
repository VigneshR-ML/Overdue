/** Canonical, fail-closed Pro entitlement resolution. */
export type Plan = "free" | "pro"

export interface SubscriptionLike {
  plan?: string | null
  status?: string | null
  current_period_end?: string | null
  created_at?: string | null
}

export const FREE_TRIAL_DAYS = 14
const FREE_TRIAL_MS = FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000

/** End of the verified paid-through window (ms), or 0 if missing/invalid. */
export function graceUntil(sub: SubscriptionLike | null | undefined, _now: number = Date.now()): number {
  if (!sub?.current_period_end) return 0
  const time = new Date(sub.current_period_end).getTime()
  return Number.isFinite(time) ? time : 0
}

/**
 * The free trial is tied to the server-created subscription row. That row is
 * written only by the signup trigger / billing webhooks, never by the browser,
 * so a client cannot reset its start time.
 */
export function trialEndsAt(sub: SubscriptionLike | null | undefined): number {
  if (!sub || sub.plan !== "free" || (sub.status ?? "").toLowerCase() !== "active" || !sub.created_at) return 0
  const startedAt = new Date(sub.created_at).getTime()
  return Number.isFinite(startedAt) ? startedAt + FREE_TRIAL_MS : 0
}

export function isFreeTrialActive(sub: SubscriptionLike | null | undefined, now: number = Date.now()): boolean {
  return trialEndsAt(sub) > now
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
  if (isFreeTrialActive(sub, now)) return "pro"
  if (!sub || sub.plan !== "pro") return "free"
  const status = (sub.status ?? "").toLowerCase()
  if (status === "active" || status === "trialing") return "pro"
  if (["cancelled", "past_due", "paused", "on_hold"].includes(status)) {
    return graceUntil(sub, now) > now ? "pro" : "free"
  }
  return "free"
}
