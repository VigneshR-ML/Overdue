import crypto from "crypto"

function getSecret(): string {
  // Dedicated secret preferred; CRON_SECRET fallback so self-hosted deploys work.
  const s = process.env.SETTLEMENT_SECRET ?? process.env.CRON_SECRET
  if (!s) throw new Error("SETTLEMENT_SECRET (or CRON_SECRET) is required for resolution links")
  return s
}

/** Opaque public token: `<offerId>.<expiryMs>.<sig>` — no login needed to resolve. */
export function signResolutionToken(offerId: string, expiresAtMs: number): string {
  const payload = `${offerId}.${expiresAtMs}`
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url").slice(0, 32)
  return `${payload}.${sig}`
}

export function verifyResolutionToken(token: string): { offerId: string; expiresAtMs: number } | null {
  const [offerId, expRaw, sig] = token.split(".")
  if (!offerId || !expRaw || !sig) return null
  const expiresAtMs = Number(expRaw)
  if (!Number.isFinite(expiresAtMs)) return null
  const expect = crypto
    .createHmac("sha256", getSecret())
    .update(`${offerId}.${expRaw}`)
    .digest("base64url")
    .slice(0, 32)
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length) return null
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  if (diff !== 0) return null
  return { offerId, expiresAtMs }
}


/** Renewable, plan-scoped portal token. It is independent of short-lived
 * settlement offers so a debtor can return for later installments. */
export function signPlanPortalToken(planId: string, expiresAtMs: number): string {
  const payload = `plan.${planId}.${expiresAtMs}`
  const sig = crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url").slice(0, 32)
  return `${payload}.${sig}`
}

export function verifyPlanPortalToken(token: string): { planId: string; expiresAtMs: number } | null {
  const [prefix, planId, expRaw, sig] = token.split(".")
  if (prefix !== "plan" || !planId || !expRaw || !sig) return null
  const expiresAtMs = Number(expRaw)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null
  const expect = crypto.createHmac("sha256", getSecret()).update(`plan.${planId}.${expRaw}`).digest("base64url").slice(0, 32)
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length) return null
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0 ? { planId, expiresAtMs } : null
}
