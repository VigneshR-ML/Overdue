import crypto from "crypto"

const SECRET = process.env.CRON_SECRET
if (!SECRET) throw new Error("CRON_SECRET is required for OAuth state signing — refusing to start with a dev fallback")

export function signState(userId: string) {
  const payload = Buffer.from(userId).toString("base64url")
  const sig = crypto.createHmac("sha256", SECRET!).update(payload).digest("base64url").slice(0, 24)
  return `${payload}.${sig}`
}

export function verifyState(state: string): string | null {
  const [payload, sig] = state.split(".")
  if (!payload || !sig) return null
  const expect = crypto
    .createHmac("sha256", SECRET!)
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
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) console.warn("[app] NEXT_PUBLIC_APP_URL is not set — OAuth redirects and SEO metadata will use localhost:3000")
  return url ?? "http://localhost:3000"
}