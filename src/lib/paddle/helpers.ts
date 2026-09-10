import crypto from "crypto"

export const PADDLE_ENV =
  process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "live" ? "live" : "sandbox"

export function verifyPaddleSignature(header: string, rawBody: string): boolean {
  if (!header) return false
  const secret = process.env.PADDLE_WEBHOOK_SECRET
  if (!secret) return false

  const [tsPart, h1Part] = header.split(";")
  const ts = tsPart?.replace("ts=", "")
  const h1 = h1Part?.replace("h1=", "")
  if (!ts || !h1) return false

  // Reject webhooks older than 5 minutes to prevent replay attacks.
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (age > 300) return false

  const signed = crypto.createHmac("sha256", secret).update(`${ts};${rawBody}`).digest("hex")
  const a = Buffer.from(signed, "hex")
  const b = Buffer.from(h1, "hex")
  if (a.length !== b.length) return false

  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export function verifyResendSignature(header: string, rawBody: string): boolean {
  if (!header) return false
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return false

  const [tsPart, sigPart] = header.split(",")
  const ts = tsPart?.replace("t=", "")
  const sig = sigPart?.replace("v1=", "")

  const signed = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex")

  const a = Buffer.from(signed, "hex")
  const b = Buffer.from(sig, "hex")
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Verifies the inbound (reply-detection) email webhook. Accepts either a Svix
 * signature header (Resend inbound) signed with INBOUND_WEBHOOK_SECRET, or a
 * plain `Authorization: Bearer <secret>` (simpler providers). Either path must
 * match the same shared secret.
 */
export function verifyInboundReplySignature(opts: {
  signature: string
  bearer: string
  rawBody: string
}): boolean {
  const secret = process.env.INBOUND_WEBHOOK_SECRET
  if (!secret) return false

  if (opts.bearer) {
    const a = Buffer.from(opts.bearer)
    const b = Buffer.from(secret)
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    if (diff === 0) return true
  }

  if (opts.signature) {
    const [tsPart, sigPart] = opts.signature.split(",")
    const ts = tsPart?.replace("t=", "")
    const sig = sigPart?.replace("v1=", "")
    if (!ts || !sig) return false
    const signed = crypto
      .createHmac("sha256", secret)
      .update(`${ts}.${opts.rawBody}`)
      .digest("hex")
    const a = Buffer.from(signed, "hex")
    const b = Buffer.from(sig, "hex")
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  }

  return false
}

// Paddle price ID for the Pro plan, per environment.
export function getProPriceId() {
  return process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY ?? ""
}

export function getVendorId() {
  return process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID ?? ""
}

export function getPaddleApiKey() {
  return process.env.PADDLE_API_KEY ?? ""
}

export function isBillingConfigured() {
  return Boolean(getVendorId() && process.env.PADDLE_API_KEY)
}