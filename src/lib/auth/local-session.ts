import { cookies } from "next/headers"

type SessionUser = { id: string; email: string }

/**
 * Decodes the signed-in user's id + email straight from a Supabase auth cookie
 * (a JSON-encoded access token), without a round trip to the auth server.
 *
 * Both the app layout and middleware use this — each passes the cookie list
 * from its own source (next/headers `cookies()` vs `request.cookies`).
 */
export function decodeSessionUser(cookies: readonly { name: string; value: string }[]): SessionUser | null {
  const authCookie = cookies.find(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
  )
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