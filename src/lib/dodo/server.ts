import "server-only"
import DodoPayments from "dodopayments"
import { getDodoApiKey, getDodoWebhookKey, dodoEnvironment, proProductId, isProProductId, isBillingConfigured } from "./helpers"

export { proProductId, isProProductId, isBillingConfigured }

/** Creates the shared Dodo API client (cached per-process). */
export function getDodoClient(): DodoPayments | null {
  const key = getDodoApiKey()
  if (!key) return null
  return new DodoPayments({
    bearerToken: key,
    environment: dodoEnvironment(),
    webhookKey: getDodoWebhookKey() || null,
  })
}

/** Hosted checkout for Pro, keyed to the session user via metadata. */
export async function createCheckout(opts: {
  userId: string
  email?: string
  name?: string
}): Promise<{ url: string; sessionId?: string } | null> {
  const client = getDodoClient()
  const productId = proProductId()
  if (!client || !productId) return null
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: opts.email ? { email: opts.email, name: opts.name ?? undefined } : undefined,
      metadata: { app_user_id: opts.userId },
      return_url: appUrl ? `${appUrl}/settings/billing?upgraded=1` : undefined,
    })
    if (!session.checkout_url) return null
    return { url: session.checkout_url, sessionId: session.session_id }
  } catch (e) {
    console.error("[dodo] createCheckout failed:", e)
    return null
  }
}

/** Fresh customer portal URL (24h link). */
export async function getCustomerPortalUrl(
  customerId: string | null,
  opts?: { returnUrl?: string },
): Promise<string | null> {
  const client = getDodoClient()
  if (!client || !customerId) return null
  try {
    const portal = await client.customers.customerPortal.create(customerId, {
      ...(opts?.returnUrl ? { return_url: opts.returnUrl } : {}),
    })
    return portal.link ?? null
  } catch (e) {
    console.error("[dodo] getCustomerPortalUrl failed:", e)
    return null
  }
}

/** Cancel at next billing date (keeps access until the period ends). */
export async function cancelSubscription(subscriptionId: string): Promise<boolean> {
  const client = getDodoClient()
  if (!client || !subscriptionId) return false
  try {
    await client.subscriptions.update(subscriptionId, { cancel_at_next_billing_date: true })
    return true
  } catch (e) {
    console.error("[dodo] cancelSubscription failed:", e)
    return false
  }
}