import crypto from "crypto"

const STATE_MAX_AGE_MS = 10 * 60 * 1000 // 10 minutes

function getSecret(): string {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error("CRON_SECRET is required for OAuth state signing")
  return secret
}

export function signState(userId: string) {
  const secret = getSecret()
  const ts = String(Date.now())
  const payload = Buffer.from(`${userId}:${ts}`).toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 32)
  return `${payload}.${sig}`
}

export function verifyState(state: string): string | null {
  const [payload, sig] = state.split(".")
  if (!payload || !sig) return null
  const secret = getSecret()
  const expect = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url")
    .slice(0, 32)
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length) return null
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  if (diff !== 0) return null
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8")
    const lastColon = decoded.lastIndexOf(":")
    if (lastColon < 0) return null
    const userId = decoded.slice(0, lastColon)
    const ts = Number(decoded.slice(lastColon + 1))
    if (!Number.isFinite(ts) || Date.now() - ts > STATE_MAX_AGE_MS) return null
    return userId
  } catch {
    return null
  }
}

export function appUrl() {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) console.warn("[app] NEXT_PUBLIC_APP_URL is not set — OAuth redirects and SEO metadata will use localhost:3000")
  return url ?? "http://localhost:3000"
}