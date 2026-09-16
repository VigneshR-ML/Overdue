import "server-only"
import { Environment, Paddle } from "@paddle/paddle-node-sdk"
import { getPaddleApiKey, getPaddleWebhookSecret, paddleEnvironment, paddlePriceId, isPaddleBillingConfigured } from "./helpers"

export { paddlePriceId, isPaddleBillingConfigured }

/** Creates the shared Paddle API client (fresh per call — cheap to construct). */
export function getPaddleClient(): Paddle | null {
  const key = getPaddleApiKey()
  if (!key) return null
  return new Paddle(key, {
    environment: paddleEnvironment() === "live" ? Environment.production : Environment.sandbox,
  })
}

/**
 * Verifies a Paddle webhook request. Paddle signs the raw body with the
 * webhook secret (HMAC-SHA256); the signature arrives in the
 * `paddle-signature` header as `ts=...;h1=...`. Uses the SDK's validator via
 * `webhooks.unmarshal` — throws on invalid signature.
 */
export async function verifyPaddleWebhook(rawBody: string, signature: string): Promise<unknown | null> {
  const client = getPaddleClient()
  const secret = getPaddleWebhookSecret()
  if (!client || !secret || !rawBody || !signature) return null
  try {
    const event = await client.webhooks.unmarshal(rawBody, secret, signature)
    return event
  } catch (e) {
    console.error("[paddle] webhook signature verification failed:", e)
    return null
  }
}

/** Hosted checkout for Pro, keyed to the session user via custom_data. */
export async function createPaddleCheckout(opts: {
  userId: string
  email?: string
  name?: string
}): Promise<{ url: string; transactionId?: string } | null> {
  const client = getPaddleClient()
  const priceId = paddlePriceId()
  if (!client || !priceId) return null
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
  try {
    const transaction = await client.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customer: opts.email ? { email: opts.email } : undefined,
      customData: { app_user_id: opts.userId },
      ...(appUrl
        ? {
            checkout: {
              url: `${appUrl}/settings/billing?upgraded=1`,
            },
          }
        : {}),
    } as never)
    const tx = transaction as unknown as {
      id?: string
      checkout?: { url?: string }
    }
    if (!tx?.checkout?.url) return null
    return { url: tx.checkout.url, transactionId: tx.id }
  } catch (e) {
    console.error("[paddle] createPaddleCheckout failed:", e)
    return null
  }
}

/** Fresh customer portal URL. Paddle portals are per-customer update links. */
export async function getPaddlePortalUrl(customerId: string | null): Promise<string | null> {
  const client = getPaddleClient()
  if (!client || !customerId) return null
  try {
    const portal = (await (client.customers as unknown as {
      createCustomerPortalSession: (id: string) => Promise<{ urls?: { general?: { overview?: string } } }>
    }).createCustomerPortalSession(customerId)) as { urls?: { general?: { overview?: string } } }
    return portal?.urls?.general?.overview ?? null
  } catch (e) {
    console.error("[paddle] getPaddlePortalUrl failed:", e)
    return null
  }
}

/** Cancel at next billing date (keeps access until the period ends). */
export async function cancelPaddleSubscription(subscriptionId: string): Promise<boolean> {
  const client = getPaddleClient()
  if (!client || !subscriptionId) return false
  try {
    await client.subscriptions.cancel(subscriptionId, { effectiveFrom: "next_billing_period" })
    return true
  } catch (e) {
    console.error("[paddle] cancelPaddleSubscription failed:", e)
    return false
  }
}
