import { Environment, Paddle } from "@paddle/paddle-node-sdk"
import { getPaddleApiKey } from "./helpers"

let _client: Paddle | null = null

export function getPaddleServer() {
  if (!_client) {
    const apiKey = getPaddleApiKey()
    if (!apiKey) return null
    _client = new Paddle(apiKey, {
      environment:
        process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "live"
          ? Environment.production
          : Environment.sandbox,
    })
  }
  return _client
}

export async function getCustomerPortalUrl(subscriptionId: string | null) {
  if (!subscriptionId) return null
  const apiKey = getPaddleApiKey()
  if (!apiKey) return null
  try {
    const base =
      process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "live"
        ? "https://api.paddle.com"
        : "https://sandbox-api.paddle.com"
    const res = await fetch(`${base}/subscriptions/${subscriptionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.data?.urls?.customer_portal ?? json?.data?.urls?.update_payment_method ?? null
  } catch {
    return null
  }
}

export async function pauseSubscription(subscriptionId: string) {
  const paddle = getPaddleServer()
  if (!paddle) return null
  try {
    return await paddle.subscriptions.pause(subscriptionId, { effectiveFrom: "immediately" })
  } catch {
    return null
  }
}

export async function cancelSubscription(subscriptionId: string) {
  const paddle = getPaddleServer()
  if (!paddle) return null
  try {
    return await paddle.subscriptions.cancel(subscriptionId, { effectiveFrom: "next_billing_period" })
  } catch {
    return null
  }
}