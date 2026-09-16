/**
 * Paddle Billing environment helpers.
 *
 * Paddle is the primary merchant of record. Checkout transactions are created
 * server-side (POST /api/billing/paddle/checkout) with custom_data.app_user_id
 * bound, so webhooks resolve without relying on email matching.
 *
 * Env vars (see .env.example):
 *   PADDLE_API_KEY=<server-only API key>
 *   PADDLE_WEBHOOK_SECRET=<pdl_ntfset_... from the webhook endpoint>
 *   PADDLE_ENVIRONMENT=sandbox | live
 *   PADDLE_PRICE_PRO_MONTHLY=<price id (pri_...) for the Pro monthly sub>
 */

/** Matches Paddle's environment values (used by the SDK client). */
export function paddleEnvironment(): "sandbox" | "live" {
  const v = (process.env.PADDLE_ENVIRONMENT || process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || "sandbox").toLowerCase()
  return v === "live" ? "live" : "sandbox"
}

export function getPaddleApiKey(): string {
  return process.env.PADDLE_API_KEY || ""
}

export function getPaddleWebhookSecret(): string {
  return process.env.PADDLE_WEBHOOK_SECRET || ""
}

/** Price id of the monthly Pro plan on Paddle. */
export function paddlePriceId(): string | null {
  return process.env.PADDLE_PRICE_PRO_MONTHLY || process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY || null
}

/**
 * True when `id` matches the configured Pro price; null when no price id is
 * configured (caller should keep the existing plan).
 */
export function isProPriceId(id: unknown): boolean | null {
  const want = paddlePriceId()
  if (!want || id === null || id === undefined || id === "") return null
  return String(id) === want
}

/** True when both the Paddle API key and the Pro price id are configured. */
export function isPaddleBillingConfigured(): boolean {
  return Boolean(getPaddleApiKey() && paddlePriceId())
}

/** Local statuses we persist (a subset of the DB check constraint). */
export type LocalStatus =
  | "active"
  | "on_hold"
  | "paused"
  | "past_due"
  | "cancelled"
  | "failed"
  | "expired"

/**
 * Maps Paddle's subscription status to the local status column. Unknown
 * values fall back to `active` so an unrecognised lifecycle event never
 * revokes access.
 */
export function mapPaddleStatus(raw?: string | null): LocalStatus {
  const s = (raw ?? "").toLowerCase()
  switch (s) {
    case "on_hold":
      return "on_hold"
    case "paused":
      return "paused"
    case "past_due":
      return "past_due"
    case "canceled":
    case "cancelled":
      return "cancelled"
    case "failed":
      return "failed"
    case "expired":
      return "expired"
    default:
      return "active"
  }
}
