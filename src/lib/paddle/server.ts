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

/** One-line summary of a Paddle SDK error for server logs (no secrets). */
function paddleErrorDetails(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { message?: unknown; code?: unknown; detail?: unknown; errors?: unknown }
    try {
      const s = JSON.stringify({ message: err.message, code: err.code, detail: err.detail, errors: err.errors })
      if (s && s !== "{}") return s.slice(0, 2000)
    } catch {
      // fall through to plain message
    }
    return String(err.message ?? e).slice(0, 500)
  }
  return String(e).slice(0, 500)
}

/**
 * Finds the Paddle customer by email, creating one when missing. The
 * transaction API only accepts an existing `customerId` (no inline
 * customer), so this must run before creating the checkout transaction.
 */
async function resolvePaddleCustomerId(
  client: Paddle,
  email: string,
  name?: string,
): Promise<string | undefined> {
  const lower = email.toLowerCase()
  try {
    const firstPage = await client.customers.list({ search: email }).next()
    const match = firstPage.find((c) => c?.email?.toLowerCase() === lower) ?? firstPage[0]
    if (match?.id) return match.id
  } catch (e) {
    console.error("[paddle] customer lookup failed:", paddleErrorDetails(e))
  }
  try {
    const created = await client.customers.create({ email, ...(name ? { name } : {}) })
    if (created?.id) return created.id
  } catch (e) {
    console.error("[paddle] customer create failed:", paddleErrorDetails(e))
  }
  return undefined
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
    const customerId = opts.email ? await resolvePaddleCustomerId(client, opts.email, opts.name) : undefined
    const transaction = await client.transactions.create({
      items: [{ priceId, quantity: 1 }],
      ...(customerId ? { customerId } : {}),
      customData: { app_user_id: opts.userId },
      ...(appUrl
        ? {
            checkout: {
              url: `${appUrl}/settings/billing?upgraded=1`,
            },
          }
        : {}),
    })
    const url = transaction?.checkout?.url ?? null
    if (!url) {
      console.error(
        "[paddle] transaction created without checkout url:",
        JSON.stringify({ id: transaction?.id, status: (transaction as { status?: unknown })?.status }),
      )
      return null
    }
    return { url, transactionId: transaction.id }
  } catch (e) {
    console.error("[paddle] createPaddleCheckout failed:", paddleErrorDetails(e))
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
