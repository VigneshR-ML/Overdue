import { createAdminClient } from "@/lib/supabase/admin"
import { getDodoClient } from "@/lib/dodo/server"
import { proProductId } from "@/lib/dodo/helpers"
import { getPaddleClient } from "@/lib/paddle/server"
import { paddlePriceId, isPaddleBillingConfigured } from "@/lib/paddle/helpers"

/**
 * Server-side reconciliation between Dodo Payments (source of truth) and the
 * local `subscriptions` row. Used to:
 *   - bind a Dodo customer/product to a user the moment a checkout completes
 *     (webhooks resolve by metadata/email/id, so later events don't depend on
 *     the first matched email);
 *   - self-heal on the billing page when webhooks lag or aren't configured.
 */

export interface DodoCustomer {
  customer_id: string
  email: string
  name?: string
}

export interface DodoSubscription {
  subscription_id: string
  customer?: { customer_id: string; email?: string; name?: string } | null
  product_id?: string | null
  status?: string | null
  next_billing_date?: string | null
  expires_at?: string | null
  cancel_at_next_billing_date?: boolean | null
}

const PREFERRED = new Set(["active", "on_hold", "paused", "past_due", "pending"])

export function mapStatus(raw?: string | null): string {
  const s = (raw ?? "active").toLowerCase()
  if (s === "pending") return "active"
  if (s === "on_hold") return "on_hold"
  if (s === "paused") return "paused"
  if (s === "past_due") return "past_due"
  if (s === "cancelled") return "cancelled"
  if (s === "failed") return "failed"
  if (s === "expired") return "expired"
  return "active"
}

function planForSub(sub: DodoSubscription): "free" | "pro" {
  const want = proProductId()
  const got = sub?.product_id
  if (!want || got === undefined || got === null) return "free"
  return String(got) === String(want) ? "pro" : "free"
}

export async function findDodoCustomerByEmail(email: string): Promise<{ id: string } | null> {
  const client = getDodoClient()
  if (!client || !email) return null
  try {
    const page = (await client.customers.list({ email, page_size: 50 })) as unknown as {
      items?: DodoCustomer[]
    }
    const first = page?.items?.[0]
    return first?.customer_id ? { id: first.customer_id } : null
  } catch (e) {
    console.error("[dodo] findDodoCustomerByEmail failed:", e)
    return null
  }
}

export async function findDodoSubscriptions(customerId: string): Promise<DodoSubscription[]> {
  const client = getDodoClient()
  if (!client || !customerId) return []
  try {
    const page = (await client.subscriptions.list({ customer_id: customerId, page_size: 50 })) as unknown as {
      items?: DodoSubscription[]
    }
    return page?.items ?? []
  } catch (e) {
    console.error("[dodo] findDodoSubscriptions failed:", e)
    return []
  }
}

export function pickCurrentSubscription(subs: DodoSubscription[]): DodoSubscription | null {
  if (subs.length === 0) return null
  const usable = subs.filter((s) => PREFERRED.has((s.status ?? "").toLowerCase()))
  return (usable[0] ?? subs[0]) ?? null
}

/** Writes (or at least attaches ids to) a Dodo subscription row. */
export async function upsertDodoSubscription(userId: string, sub: DodoSubscription) {
  const supabase = createAdminClient()
  if (!supabase || !sub?.subscription_id) return
  const customerId = sub.customer?.customer_id
    ? String(sub.customer.customer_id)
    : null
  const productId = sub.product_id !== undefined && sub.product_id !== null ? String(sub.product_id) : null

  const patch: Record<string, string> = { dodo_subscription_id: String(sub.subscription_id) }
  if (customerId) patch.dodo_customer_id = customerId
  if (productId) patch.product_id = productId
  await supabase
    .from("subscriptions")
    .update(patch)
    .eq("user_id", userId)
    .is("dodo_subscription_id", null)

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      dodo_subscription_id: String(sub.subscription_id),
      dodo_customer_id: customerId,
      product_id: productId,
      plan: planForSub(sub),
      status: mapStatus(sub?.status),
      current_period_end: sub?.next_billing_date ?? sub?.expires_at ?? null,
    },
    { onConflict: "dodo_subscription_id" },
  )

  // Keep a single row per user: drop sibling rows (previous Dodo sub ids or the
  // free placeholder that never got a Dodo id). getPlan() assumes one row/user.
  await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", userId)
    .or(`dodo_subscription_id.is.null,dodo_subscription_id.neq.${sub.subscription_id}`)
}

/**
 * Reconciles a user's local subscription row against Dodo Payments. Prefers the
 * customer_id we already know, then falls back to looking the customer up by
 * email. Returns true when we found and applied a subscription.
 */
export async function reconcileDodoSubscription(
  userId: string,
  email: string,
): Promise<{ applied: boolean; subscriptionId?: string; customerId?: string }> {
  const supabase = createAdminClient()
  if (!supabase) return { applied: false }

  const { data: row } = await supabase
    .from("subscriptions")
    .select("dodo_customer_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let customerId: string | null =
    (row as { dodo_customer_id?: string } | null)?.dodo_customer_id ?? null
  if (!customerId) {
    const customer = await findDodoCustomerByEmail(email)
    customerId = customer?.id ?? null
  }
  if (!customerId) return { applied: false }

  await supabase
    .from("subscriptions")
    .update({ dodo_customer_id: customerId })
    .eq("user_id", userId)
    .is("dodo_customer_id", null)

  const subs = await findDodoSubscriptions(customerId)
  const current = pickCurrentSubscription(subs)
  if (!current) return { applied: false, customerId }

  await upsertDodoSubscription(userId, current)
  return { applied: true, subscriptionId: current.subscription_id, customerId }
}

/** Safe re-export so callers can reset a stale customer binding in one call. */
export async function attachDodoCustomerId(userId: string, customerId: string) {
  const supabase = createAdminClient()
  if (!supabase || !customerId) return
  await supabase
    .from("subscriptions")
    .update({ dodo_customer_id: String(customerId) })
    .eq("user_id", userId)
    .is("dodo_customer_id", null)
}

// ---------------------------------------------------------------------------
// Paddle reconciliation (primary merchant of record; Dodo above is the fallback).
// ---------------------------------------------------------------------------

export interface PaddleCustomer {
  id: string
  email: string
  name?: string | null
}

export interface PaddleSubscription {
  id: string
  customerId?: string | null
  status?: string | null
  customData?: Record<string, unknown> | null
  items?: Array<{ price?: { id?: string } }> | null
  currentBillingPeriod?: { endsAt?: string | null } | null
  nextBillingPeriod?: { startsAt?: string | null } | null
}

const PADDLE_PREFERRED = new Set(["active", "trialing", "past_due", "paused", "on_hold"])

export function mapPaddleStatus(raw?: string | null): string {
  const s = (raw ?? "active").toLowerCase()
  if (s === "trialing") return "active"
  if (s === "on_hold") return "on_hold"
  if (s === "paused") return "paused"
  if (s === "past_due") return "past_due"
  if (s === "canceled" || s === "cancelled") return "cancelled"
  if (s === "expired") return "expired"
  return "active"
}

function planForPaddleSub(sub: PaddleSubscription): "free" | "pro" {
  const want = paddlePriceId()
  const got = sub?.items?.[0]?.price?.id
  if (!want || got === undefined || got === null) return "free"
  return String(got) === String(want) ? "pro" : "free"
}

export async function findPaddleCustomerByEmail(email: string): Promise<{ id: string } | null> {
  const client = getPaddleClient()
  if (!client || !email) return null
  try {
    const page = await client.customers.list({ search: email } as never) as unknown as {
      data?: PaddleCustomer[]
    }
    const match = (page?.data ?? []).find((c) => c.email?.toLowerCase() === email.toLowerCase()) ?? page?.data?.[0]
    return match?.id ? { id: match.id } : null
  } catch (e) {
    console.error("[paddle] findPaddleCustomerByEmail failed:", e)
    return null
  }
}

export async function findPaddleSubscriptions(customerId: string): Promise<PaddleSubscription[]> {
  const client = getPaddleClient()
  if (!client || !customerId) return []
  try {
    const page = (await client.subscriptions.list({ customerId } as never)) as unknown as {
      data?: Array<Record<string, unknown>>
    }
    return ((page?.data ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: String(s.id ?? ""),
      customerId: (s.customerId as string | undefined) ?? customerId,
      status: (s.status as string | undefined) ?? null,
      customData: (s.customData as Record<string, unknown> | undefined) ?? null,
      items: (s.items as PaddleSubscription["items"]) ?? null,
      currentBillingPeriod: (s.currentBillingPeriod as PaddleSubscription["currentBillingPeriod"]) ?? null,
      nextBillingPeriod: (s.nextBillingPeriod as PaddleSubscription["nextBillingPeriod"]) ?? null,
    })).filter((s) => s.id)
  } catch (e) {
    console.error("[paddle] findPaddleSubscriptions failed:", e)
    return []
  }
}

export function pickCurrentPaddleSubscription(subs: PaddleSubscription[]): PaddleSubscription | null {
  if (subs.length === 0) return null
  const usable = subs.filter((s) => PADDLE_PREFERRED.has((s.status ?? "").toLowerCase()))
  return (usable[0] ?? subs[0]) ?? null
}

/** Writes (or at least attaches ids to) a Paddle subscription row. */
export async function upsertPaddleSubscription(userId: string, sub: PaddleSubscription) {
  const supabase = createAdminClient()
  if (!supabase || !sub?.id) return
  const customerId = sub.customerId ? String(sub.customerId) : null
  const priceId = sub.items?.[0]?.price?.id !== undefined && sub.items?.[0]?.price?.id !== null
    ? String(sub.items[0].price!.id)
    : null
  const periodEnd = sub?.currentBillingPeriod?.endsAt ?? sub?.nextBillingPeriod?.startsAt ?? null

  const patch: Record<string, string> = {
    paddle_subscription_id: String(sub.id),
    billing_provider: "paddle",
  }
  if (customerId) patch.paddle_customer_id = customerId
  if (priceId) patch.product_id = priceId
  await supabase
    .from("subscriptions")
    .update(patch)
    .eq("user_id", userId)
    .is("paddle_subscription_id", null)

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      paddle_subscription_id: String(sub.id),
      paddle_customer_id: customerId,
      product_id: priceId,
      billing_provider: "paddle",
      plan: planForPaddleSub(sub),
      status: mapPaddleStatus(sub?.status),
      current_period_end: periodEnd,
    },
    { onConflict: "paddle_subscription_id" },
  )

  // Keep a single row per user: drop sibling rows (previous Paddle sub ids or
  // the free placeholder that never got a Paddle id). getPlan() assumes one
  // row/user.
  await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", userId)
    .or(`paddle_subscription_id.is.null,paddle_subscription_id.neq.${sub.id}`)
}

/**
 * Reconciles a user's local subscription row against Paddle (source of
 * truth). Prefers the customer_id we already know, then falls back to looking
 * the customer up by email. Returns true when we found and applied a
 * subscription.
 */
export async function reconcilePaddleSubscription(
  userId: string,
  email: string,
): Promise<{ applied: boolean; subscriptionId?: string; customerId?: string }> {
  if (!isPaddleBillingConfigured()) return { applied: false }
  const supabase = createAdminClient()
  if (!supabase) return { applied: false }

  const { data: row } = await supabase
    .from("subscriptions")
    .select("paddle_customer_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let customerId: string | null =
    (row as { paddle_customer_id?: string } | null)?.paddle_customer_id ?? null
  if (!customerId) {
    const customer = await findPaddleCustomerByEmail(email)
    customerId = customer?.id ?? null
  }
  if (!customerId) return { applied: false }

  await supabase
    .from("subscriptions")
    .update({ paddle_customer_id: customerId })
    .eq("user_id", userId)
    .is("paddle_customer_id", null)

  const subs = await findPaddleSubscriptions(customerId)
  const current = pickCurrentPaddleSubscription(subs)
  if (!current) return { applied: false, customerId }

  await upsertPaddleSubscription(userId, current)
  return { applied: true, subscriptionId: current.id, customerId }
}

/** Safe re-export so callers can reset a stale customer binding in one call. */
export async function attachPaddleCustomerId(userId: string, customerId: string) {
  const supabase = createAdminClient()
  if (!supabase || !customerId) return
  await supabase
    .from("subscriptions")
    .update({ paddle_customer_id: String(customerId) })
    .eq("user_id", userId)
    .is("paddle_customer_id", null)
}