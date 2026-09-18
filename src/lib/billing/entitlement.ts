/**
 * Canonical plan resolution (D14). Every plan decision in the app routes
 * through here — dispatch, quota gates, billing pages and AI gates — so they
 * can never disagree about who is "pro".
 *
 * Purely functional: takes the subscription row (postgrest shape) and a clock,
 * returns the effective plan. No next/headers, no DB, safe to unit-test.
 */

export type Plan = "free" | "pro"

export interface SubscriptionLike {
  plan?: string | null
  status?: string | null
  current_period_end?: string | null
}

/** End of the paid grace window (ms), or 0 when there is none. */
export function graceUntil(sub: SubscriptionLike | null | undefined, now: number = Date.now()): number {
  if (!sub) return 0
  const end = sub.current_period_end
  if (!end) return 0
  const t = new Date(end).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * Resolves the effective plan for a subscription row.
 *  - no row, or not on the 'pro' price → free;
 *  - failed / expired revoke Pro outright;
 *  - cancelled keeps Pro through the paid grace period (current_period_end);
 *  - active / on_hold / paused / past_due keep Pro during the retry window so a
 *    failed renewal doesn't instantly lock users out.
 */
export function planForSubscription(
  sub: SubscriptionLike | null | undefined,
  now: number = Date.now(),
): Plan {
  if (!sub) return "free"
  if (sub.plan !== "pro") return "free"
  const status = (sub.status ?? "").toLowerCase()
  if (status === "failed" || status === "expired") return "free"
  if (status === "cancelled") return graceUntil(sub, now) > now ? "pro" : "free"
  return "pro"
}