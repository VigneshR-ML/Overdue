import { cookies } from "next/headers"

/**
 * Reads the signed-in user's id + email straight from the Supabase auth cookie
 * (a JSON-encoded access token), without a round trip to the auth server.
 *
 * Middleware already verified and refreshed the session fields on the way in,
 * so for display purposes (top bar avatar, plan lookup) decoding the JWT is
 * enough — no network call, no DB query, every navigation stays fast.
 */
export function getSessionUserFromCookies(): { id: string; email: string } | null {
  const store = cookies()
  const authCookie = store
    .getAll()
    .find((c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"))
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
    ) as { sub?: unknown; email?: unknown }
    if (typeof payload.sub !== "string" || !payload.sub) return null

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "you@ledger.app",
    }
  } catch {
    return null
  }
}