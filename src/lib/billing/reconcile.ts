import { createAdminClient } from "@/lib/supabase/admin"
import { PADDLE_ENV } from "@/lib/paddle/helpers"

/**
 * Server-side reconciliation between Paddle (source of truth) and the local
 * `subscriptions` row. Used to:
 *   - bind a Paddle customer_id to a user the moment a checkout completes
 *     (customers ARE resolved by id in webhooks, so future events don't depend
 *     on a perfect email match);
 *   - self-heal on the billing page when webhooks lag or aren't configured.
 *
 * Uses the Paddle Billing REST API directly (same key as the Node SDK).
 */

const API_BASE =
  PADDLE_ENV === "live" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com"

function bearerHeaders(): Record<string, string> {
  const key = process.env.PADDLE_API_KEY
  return key ? { Authorization: `Bearer ${key}` } : {}
}

async function getJson<T = any>(path: string): Promise<T | null> {
  const key = process.env.PADDLE_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: bearerHeaders() })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function mapStatus(raw?: string | null): "active" | "trialing" | "past_due" | "cancelled" {
  const s = (raw ?? "active").toLowerCase()
  if (s.includes("trial")) return "trialing"
  if (s.includes("paused") || s.includes("past_due")) return "past_due"
  if (s.includes("cancel")) return "cancelled"
  return "active"
}

function planForSub(sub: any): "free" | "pro" {
  const priceId = process.env.PADDLE_PRICE_PRO_MONTHLY ?? ""
  return sub?.items?.some?.((i: any) => i.price?.id === priceId) ? "pro" : "free"
}

export interface PdSubscription {
  id: string
  customer_id: string | null
  status?: string
  items?: { price?: { id?: string } }[]
  current_billing_period?: { ends_at?: string | null }
}

export async function findPdCustomerByEmail(email: string): Promise<{ id: string } | null> {
  const j = await getJson<{ data?: { id: string }[] }>(`/customers?email=${encodeURIComponent(email)}`)
  return j?.data?.[0] ?? null
}

export async function findPdSubscriptions(customerId: string): Promise<PdSubscription[]> {
  const j = await getJson<{ data?: PdSubscription[] }>(`/subscriptions?customer_id=${encodeURIComponent(customerId)}`)
  return j?.data ?? []
}

export function pickCurrentSubscription(subs: PdSubscription[]): PdSubscription | null {
  if (subs.length === 0) return null
  const active = subs.filter((s) => {
    const st = (s.status ?? "").toLowerCase()
    return st === "active" || st === "trialing" || st === "past_due"
  })
  return (active[0] ?? subs[0]) ?? null
}

/** Writes (or at least attaches ids to) a Paddle subscription row. */
export async function upsertPdSubscription(userId: string, sub: PdSubscription) {
  const supabase = createAdminClient()
  if (!supabase || !sub.id) return
  const customerId = sub.customer_id ?? null

  // Attach ids to the user's default (null-paddle) row first, if present.
  await supabase
    .from("subscriptions")
    .update({ paddle_subscription_id: sub.id, paddle_customer_id: customerId })
    .eq("user_id", userId)
    .is("paddle_subscription_id", null)

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: sub.id,
      paddle_customer_id: customerId,
      plan: planForSub(sub),
      status: mapStatus(sub.status),
      current_period_end: sub.current_billing_period?.ends_at ?? null,
    },
    { onConflict: "paddle_subscription_id" },
  )
}

/**
 * Reconciles a user's local subscription row against Paddle. Prefers the
 * customer_id we already know, then falls back to looking the customer up by
 * email. Returns true when we found and applied a subscription.
 */
export async function reconcilePaddleSubscription(
  userId: string,
  email: string,
): Promise<{ applied: boolean; subscriptionId?: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { applied: false }

  const { data: row } = await supabase
    .from("subscriptions")
    .select("paddle_customer_id")
    .eq("user_id", userId)
    .maybeSingle()

  let customerId: string | null = row?.paddle_customer_id ?? null
  if (!customerId) {
    const customer = await findPdCustomerByEmail(email)
    customerId = customer?.id ?? null
  }
  if (!customerId) return { applied: false }

  await supabase
    .from("subscriptions")
    .update({ paddle_customer_id: customerId })
    .eq("user_id", userId)
    .is("paddle_customer_id", null)

  const subs = await findPdSubscriptions(customerId)
  const current = pickCurrentSubscription(subs)
  if (!current) return { applied: false }

  await upsertPdSubscription(userId, current)
  return { applied: true, subscriptionId: current.id }
}

/** Binds a freshly-created Paddle customer_id to the session user and reconciles. */
export async function attachPaddleCustomer(userId: string, customerId: string) {
  const supabase = createAdminClient()
  if (!supabase || !customerId) return { applied: false }

  await supabase
    .from("subscriptions")
    .update({ paddle_customer_id: customerId })
    .eq("user_id", userId)
    .is("paddle_customer_id", null)

  const subs = await findPdSubscriptions(customerId)
  const current = pickCurrentSubscription(subs)
  if (!current) return { applied: false }

  await upsertPdSubscription(userId, current)
  return { applied: true, subscriptionId: current.id }
}