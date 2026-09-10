import crypto from "crypto"
import { getCredentials, setCredentials } from "./credentials"
import { withRefreshMutex } from "./sync"

export type PaidProvider = "stripe" | "paypal" | "xero"

function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, "hex")
    const b = Buffer.from(bHex, "hex")
    if (a.length !== b.length || a.length === 0) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } catch {
    return false
  }
}

/**
 * Stripe Connect webhook signature (no stripe SDK needed).
 * Header: "t=1492774577,v1=abc[,v1=def...]". Signs `${t}.${rawBody}`.
 * Rejects timestamps older than `toleranceSec` to prevent replays.
 */
export function verifyStripeSignature(
  header: string,
  rawBody: string,
  secret?: string,
  toleranceSec = 300,
): boolean {
  const key = secret ?? process.env.STRIPE_WEBHOOK_SECRET ?? ""
  if (!header || !key) return false
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=")
      return i < 0 ? [kv, ""] : [kv.slice(0, i).trim(), kv.slice(i + 1).trim()]
    }),
  )
  const t = parts["t"] ?? ""
  const v1s = header
    .split(",")
    .map((kv) => kv.trim())
    .filter((kv) => kv.startsWith("v1="))
    .map((kv) => kv.slice(3))
  if (!t || v1s.length === 0) return false
  const age = Math.abs(Date.now() / 1000 - Number(t))
  if (!Number.isFinite(age) || age > toleranceSec) return false
  const expected = crypto.createHmac("sha256", key).update(`${t}.${rawBody}`).digest("hex")
  return v1s.some((v1) => timingSafeEqualHex(expected, v1))
}

/**
 * Xero webhook signature. Header `x-xero-signature` is the HMAC-SHA256 of the
 * raw body with the app's webhook signing key. Xero sends it base64-encoded;
 * accept hex too so dashboard test payloads also verify.
 */
export function verifyXeroSignature(header: string, rawBody: string, key?: string): boolean {
  const secret = key ?? process.env.XERO_WEBHOOK_KEY ?? ""
  if (!header || !secret) return false
  const h = header.trim()
  const asHex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  if (timingSafeEqualHex(asHex, h)) return true
  try {
    const asB64 = crypto.createHmac("sha256", secret).update(rawBody).digest("base64")
    const a = Buffer.from(asB64)
    const b = Buffer.from(h)
    if (a.length !== b.length || a.length === 0) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } catch {
    return false
  }
}

function paypalBase(mode: string): string {
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"
}

/**
 * PayPal webhook verification (server-to-server). PayPal signs with rotating
 * certs, so verification is an API call, not a local HMAC. Returns true only
 * when PayPal answers verification_status === "SUCCESS".
 */
export async function verifyPaypalWebhook(opts: {
  transmissionId: string
  transmissionTime: string
  certUrl: string
  authAlgo: string
  transmissionSig: string
  webhookEvent: unknown
  clientId?: string
  clientSecret?: string
  webhookId?: string
  mode?: string
}): Promise<boolean> {
  const clientId = opts.clientId ?? process.env.PAYPAL_CLIENT_ID ?? ""
  const clientSecret = opts.clientSecret ?? process.env.PAYPAL_CLIENT_SECRET ?? ""
  const webhookId = opts.webhookId ?? process.env.PAYPAL_WEBHOOK_ID ?? ""
  const mode = opts.mode ?? process.env.PAYPAL_MODE ?? "sandbox"
  if (!clientId || !clientSecret || !webhookId) return false
  if (!opts.transmissionId || !opts.transmissionSig || !opts.webhookEvent) return false
  try {
    const res = await fetch(`${paypalBase(mode)}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: opts.authAlgo,
        cert_url: opts.certUrl,
        transmission_id: opts.transmissionId,
        transmission_sig: opts.transmissionSig,
        transmission_time: opts.transmissionTime,
        webhook_id: webhookId,
        webhook_event: opts.webhookEvent,
      }),
    })
    if (!res.ok) return false
    const json = (await res.json()) as { verification_status?: string }
    return json.verification_status === "SUCCESS"
  } catch {
    return false
  }
}

/**
 * Marks the synced invoice paid. Scoped to a specific user when userId is
 * provided (always preferred for cross-tenant safety). For webhook contexts
 * where the user is unknown (e.g. Stripe Connect), falls back to provider-level
 * matching but excludes manual/csv invoices to avoid cross-user collisions.
 */
export async function markInvoicePaid(
  supabase: any,
  provider: PaidProvider,
  providerId: string,
  userId?: string,
): Promise<number> {
  if (!providerId) return 0
  let query = supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("provider", provider)
    .eq("provider_id", providerId)
    .neq("status", "paid")
  // When user is known, scope to their data for safety
  if (userId) query = query.eq("user_id", userId)
  // When user is unknown, exclude manual/csv invoices to avoid cross-user collision
  else query = query.neq("provider", "manual")
  const { data, error } = await query.select("id")
  if (error) return 0
  return Array.isArray(data) ? data.length : 0
}

/** Idempotency ledger shared with the Paddle webhook (provider + event_id). */
export async function alreadyHandled(supabase: any, provider: string, eventId: string): Promise<boolean> {
  if (!eventId) return false
  const { data } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("provider", provider)
    .eq("event_id", eventId)
    .maybeSingle()
  return Boolean(data)
}

export async function recordEvent(supabase: any, provider: string, eventId: string, payload: unknown): Promise<void> {
  await supabase.from("webhook_events").insert({ provider, event_id: eventId, payload: payload ?? {} })
}

// ── Xero helpers: tenant → user → fresh token → invoice status ──────────────

/** Maps a Xero tenantId to the owning user via integrations.provider_account_id (0008). */
export async function resolveXeroUser(supabase: any, tenantId: string): Promise<string | null> {
  if (!tenantId) return null
  const { data } = await supabase
    .from("integrations")
    .select("user_id")
    .eq("provider", "xero")
    .eq("provider_account_id", tenantId)
    .maybeSingle()
  return (data as { user_id?: string } | null)?.user_id ?? null
}

async function freshXeroCreds(userId: string): Promise<{ accessToken: string; tenantId: string } | null> {
  return withRefreshMutex(`xero:${userId}`, async () => {
    const creds = await getCredentials(userId, "xero")
    if (!creds?.tenant_id) return null
    let accessToken = creds.access_token ?? ""
    const expiresAt = Number(creds.expires_at ?? 0)
    if ((!accessToken || expiresAt < Date.now() + 5 * 60 * 1000) && creds.refresh_token) {
      try {
        const res = await fetch("https://identity.xero.com/connect/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: process.env.XERO_CLIENT_ID ?? "",
            client_secret: process.env.XERO_CLIENT_SECRET ?? "",
            refresh_token: creds.refresh_token,
          }),
        })
        const token = await res.json()
        if (res.ok && token.access_token) {
          accessToken = token.access_token
          await setCredentials(userId, "xero", {
            ...creds,
            access_token: accessToken,
            refresh_token: token.refresh_token ?? creds.refresh_token,
            expires_at: String(Date.now() + (token.expires_in ?? 1800) * 1000),
          })
        }
      } catch {
        // fall through with the stale token; the API call below decides
      }
    }
    if (!accessToken) return null
    return { accessToken, tenantId: creds.tenant_id }
  })
}

/** Fetches one Xero ACCREC invoice status (AUTHORISED/PAID/…). Null on failure. */
export async function fetchXeroInvoiceStatus(
  accessToken: string,
  tenantId: string,
  invoiceId: string,
): Promise<string | null> {
  try {
    const res = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "Xero-Tenant-Id": tenantId, Accept: "application/json" },
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json.Invoices?.[0]?.Status as string) ?? null
  } catch {
    return null
  }
}

export { freshXeroCreds }
