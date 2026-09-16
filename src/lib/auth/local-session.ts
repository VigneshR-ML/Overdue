import { cookies } from "next/headers"

type SessionUser = { id: string; email: string }

/**
 * Replaces the Supabase session cookie's storage key with a regex-compatible
 * marker so we can match both the whole cookie (`sb-<ref>-auth-token`) and its
 * chunked variants (`sb-<ref>-auth-token.0`, `.1`, …).
 */
const CHUNK_COOKIE_RE = /^sb-.+-auth-token(?:\.\d+)?$/

/**
 * Joins a possibly chunked session cookie back into a single value, mirroring
 * @supabase/ssr's `combineChunks` (a session payload >3180 bytes is split
 * across `sb-<ref>-auth-token.{0,1,…}`, each holding a slice of the value).
 */
function combineCookieChunks(cookies: readonly { name: string; value: string }[]): {
  baseKey: string
  value: string
} | null {
  const found = cookies.filter((c) => CHUNK_COOKIE_RE.test(c.name))
  if (!found.length) return null

  const baseKey = found[0].name.replace(/\.\d+$/, "")
  const direct = found.find((c) => c.name === baseKey)
  if (direct) return { baseKey, value: direct.value }

  let value = ""
  for (let i = 0; ; i++) {
    const chunk = found.find((c) => c.name === `${baseKey}.${i}`)
    if (!chunk) break
    value += chunk.value
  }
  return value ? { baseKey, value } : null
}

/**
 * Decodes the signed-in user's id + email straight from a Supabase auth cookie
 * (a JSON-encoded access token), without a round trip to the auth server.
 *
 * Both the app layout and middleware use this — each passes the cookie list
 * from its own source (next/headers `cookies()` vs `request.cookies`).
 */
export function decodeSessionUser(cookies: readonly { name: string; value: string }[]): SessionUser | null {
  const authCookie = combineCookieChunks(cookies)
  if (!authCookie?.value) return null

  try {
    // @supabase/ssr stores the session as `base64-<base64url(json)>`.
    const raw = authCookie.value.startsWith("base64-")
      ? Buffer.from(authCookie.value.slice("base64-".length), "base64url").toString("utf8")
      : authCookie.value
    const parsed: unknown = JSON.parse(raw)
    const accessToken = Array.isArray(parsed)
      ? (parsed[0] as unknown)
      : typeof parsed === "object" && parsed !== null && "access_token" in parsed
        ? (parsed as { access_token?: unknown }).access_token
        : null
    if (typeof accessToken !== "string" || !accessToken) return null

    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8"),
    ) as { sub?: unknown; email?: unknown; exp?: unknown }
    if (typeof payload.sub !== "string" || !payload.sub) return null
    // Reject stagnant/expired tokens so a stale cookie never looks signed in.
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "you@ledger.app",
    }
  } catch {
    return null
  }
}

export function getSessionUserFromCookies(): SessionUser | null {
  return decodeSessionUser(cookies().getAll())
}