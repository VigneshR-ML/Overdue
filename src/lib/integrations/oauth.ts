import crypto from "crypto"

const SECRET = process.env.CRON_SECRET ?? "dev-only-oauth-secret"

export function signState(userId: string) {
  const payload = Buffer.from(userId).toString("base64url")
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url").slice(0, 24)
  return `${payload}.${sig}`
}

export function verifyState(state: string): string | null {
  const [payload, sig] = state.split(".")
  if (!payload || !sig) return null
  const expect = crypto
    .createHmac("sha256", SECRET)
    .update(payload)
    .digest("base64url")
    .slice(0, 24)
  const a = Buffer.from(sig)
  const b = Buffer.from(expect)
  if (a.length !== b.length) return null
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  if (diff !== 0) return null
  try {
    return Buffer.from(payload, "base64url").toString("utf8")
  } catch {
    return null
  }
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
}