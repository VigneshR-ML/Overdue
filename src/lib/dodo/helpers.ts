import crypto from "crypto"

/**
 * Dodo Payments environment helpers + webhook signature verification.
 * Dodo uses Standard Webhooks: headers `webhook-id`, `webhook-timestamp`,
 * `webhook-signature: "v1,<base64>"`, signed with HMAC-SHA256 over
 * "<webhook-id>.<webhook-timestamp>.<rawBody>" using the webhook key
 * (base64-encoded, prefixed with `whsec_`).
 */

const WH_SEC_PREFIX = "whsec_"
export const MAX_SIGNATURE_AGE_SECONDS = 300

/** Matches Dodo's `environment` values (used by the SDK client). */
export function dodoEnvironment(): "test_mode" | "live_mode" {
  const v = (process.env.DODO_PAYMENTS_ENVIRONMENT || "test_mode").toLowerCase()
  return v === "live_mode" ? "live_mode" : "test_mode"
}

export function getDodoApiKey(): string {
  return process.env.DODO_PAYMENTS_API_KEY || ""
}

export function getDodoWebhookKey(): string {
  return process.env.DODO_PAYMENTS_WEBHOOK_KEY || ""
}

/** Product id of the monthly Pro plan on Dodo. */
export function proProductId(): string | null {
  return process.env.DODO_PRODUCT_PRO_MONTHLY || process.env.NEXT_PUBLIC_DODO_PRODUCT_PRO_MONTHLY || null
}

/**
 * True when `id` matches the configured Pro product; null when no product id
 * is configured (caller should keep the existing plan).
 */
export function isProProductId(id: unknown): boolean | null {
  const want = proProductId()
  if (!want || id === null || id === undefined || id === "") return null
  return String(id) === want
}

/** True when both the Dodo API key and the Pro product id are configured. */
export function isBillingConfigured(): boolean {
  return Boolean(getDodoApiKey() && proProductId())
}

function safeEqualBase64(aB64: string, bB64: string): boolean {
  try {
    const a = Buffer.from(aB64, "base64")
    const b = Buffer.from(bB64, "base64")
    if (a.length !== b.length || a.length === 0) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } catch {
    return false
  }
}

/**
 * Verifies a Standard Webhooks (Svix-style) request from Dodo Payments.
 * The signing secret from the webhook dashboard is set in
 * `DODO_PAYMENTS_WEBHOOK_KEY` (value starts with `whsec_`).
 */
export function verifyDodoSignature(
  headers: { id?: string; timestamp?: string; signature?: string },
  rawBody: string,
): boolean {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature || !rawBody) return false

  const secret = getDodoWebhookKey()
  if (!secret) return false

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  if (Math.abs(Date.now() / 1000 - ts) > MAX_SIGNATURE_AGE_SECONDS) return false

  // The key is base64-encoded (Standard Webhooks); strip the whsec_ prefix.
  let key: Buffer
  try {
    key = Buffer.from(secret.startsWith(WH_SEC_PREFIX) ? secret.slice(WH_SEC_PREFIX.length) : secret, "base64")
    if (!key.length) key = Buffer.from(secret)
  } catch {
    key = Buffer.from(secret)
  }

  const signed = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64")

  // Header may carry multiple space-separated signatures.
  const candidates = signature.split(" ").map((s) => s.trim()).filter(Boolean)
  for (const c of candidates) {
    const v = c.startsWith("v1,") ? c.slice(3) : c
    if (v && safeEqualBase64(signed, v)) return true
  }
  return false
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
 * Maps Dodo's subscription status to the local status column. `pending`
 * surfaces as active (Dodo activates at checkout). Unknown values fall back to
 * `active` so an unrecognised lifecycle event never revokes access.
 */
export function mapDodoStatus(raw?: string | null): LocalStatus {
  const s = (raw ?? "").toLowerCase()
  switch (s) {
    case "on_hold":
      return "on_hold"
    case "paused":
      return "paused"
    case "past_due":
      return "past_due"
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