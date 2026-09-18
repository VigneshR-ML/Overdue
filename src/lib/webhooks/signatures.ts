import crypto from "crypto"

function safeEqualHex(aHex: string, bHex: string): boolean {
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
 * Verifies Resend (Svix) webhooks.
 * Resend sends: svix-id, svix-timestamp, svix-signature: "v1,<base64> [...]".
 * Signed content: "<svix-id>.<svix-timestamp>.<rawBody>", HMAC-SHA256 with the
 * webhook secret (strip "whsec_" prefix, base64-decode the rest).
 * Legacy "t=..,v1=hex" format is still accepted for backwards compat.
 */
export function verifyResendSignature(
  header: string,
  rawBody: string,
  opts?: { svixId?: string; svixTimestamp?: string },
): boolean {
  if (!header || !rawBody) return false
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return false

  // Svix path: svix-id + timestamp available.
  if (opts?.svixId && opts?.svixTimestamp) {
    const ts = Number(opts.svixTimestamp)
    if (!Number.isFinite(ts)) return false
    // Svix timestamps are seconds; allow 5-min skew.
    if (Math.abs(Date.now() / 1000 - ts) > 300) return false
    const keyB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret
    let key: Buffer
    try {
      key = Buffer.from(keyB64, "base64")
      if (!key.length) key = Buffer.from(secret)
    } catch {
      key = Buffer.from(secret)
    }
    const signed = crypto
      .createHmac("sha256", key)
      .update(`${opts.svixId}.${opts.svixTimestamp}.${rawBody}`)
      .digest("base64")
    // Header may carry multiple space-separated signatures.
    const candidates = header.split(" ").map((s) => s.trim()).filter(Boolean)
    for (const c of candidates) {
      const v = c.startsWith("v1,") ? c.slice(3) : c.startsWith("v1=") ? c.slice(3) : c
      if (v && safeEqualBase64(signed, v)) return true
    }
    return false
  }

  // Legacy HMAC hex path (t=...,v1=...).
  const [tsPart, sigPart] = header.split(",")
  const ts = tsPart?.replace("t=", "")?.trim()
  const sig = sigPart?.replace("v1=", "")?.trim()
  if (!ts || !sig) return false

  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > 300) return false

  const signed = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex")

  return safeEqualHex(signed, sig)
}

/**
 * Verifies the inbound (reply-detection) email webhook. Accepts either a Svix
 * signature header set (svix-id/timestamp/signature — Resend inbound) signed
 * with INBOUND_WEBHOOK_SECRET, the legacy `t=,v1=` HMAC form, or a plain
 * `Authorization: Bearer <secret>`. All paths use the same shared secret.
 */
export function verifyInboundReplySignature(opts: {
  signature: string
  bearer: string
  rawBody: string
  svixId?: string
  svixTimestamp?: string
}): boolean {
  const secret = process.env.INBOUND_WEBHOOK_SECRET
  if (!secret || !opts.rawBody) return false

  if (opts.bearer) {
    try {
      const a = Buffer.from(opts.bearer)
      const b = Buffer.from(secret)
      if (a.length === b.length && a.length > 0) {
        let diff = 0
        for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
        if (diff === 0) return true
      }
    } catch {
      // fall through to signature check
    }
  }

  if (opts.signature) {
    // Svix path (Resend inbound): svix-id + svix-timestamp present.
    const svixId = opts.svixId
    const svixTs = opts.svixTimestamp
    if (svixId && svixTs) {
      const ts = Number(svixTs)
      if (!Number.isFinite(ts)) return false
      if (Math.abs(Date.now() / 1000 - ts) > 300) return false
      const keyB64 = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret
      let key: Buffer
      try {
        key = Buffer.from(keyB64, "base64")
        if (!key.length) key = Buffer.from(secret)
      } catch {
        key = Buffer.from(secret)
      }
      const signed = crypto
        .createHmac("sha256", key)
        .update(`${svixId}.${svixTs}.${opts.rawBody}`)
        .digest("base64")
      const candidates = opts.signature.split(" ").map((s) => s.trim()).filter(Boolean)
      for (const c of candidates) {
        const v = c.startsWith("v1,") ? c.slice(3) : c.startsWith("v1=") ? c.slice(3) : c
        if (v && safeEqualBase64(signed, v)) return true
      }
      return false
    }

    // Legacy t=,v1= hex path.
    const [tsPart, sigPart] = opts.signature.split(",")
    const ts = tsPart?.replace("t=", "")?.trim()
    const sig = sigPart?.replace("v1=", "")?.trim()
    if (!ts || !sig || !/^\d+$/.test(ts)) return false
    const age = Math.abs(Date.now() / 1000 - Number(ts))
    if (!Number.isFinite(age) || age > 300) return false
    const signed = crypto
      .createHmac("sha256", secret)
      .update(`${ts}.${opts.rawBody}`)
      .digest("hex")
    return safeEqualHex(signed, sig)
  }

  return false
}