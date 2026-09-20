import { createClient } from "@/lib/supabase/server"
import { decodeSessionUser } from "@/lib/auth/local-session"
import { cookies } from "next/headers"

/**
 * Resolves the current session user for Server Components. Returns null when
 * unauthenticated.
 *
 * `getUser()` is the source of truth (validates + refreshes against the auth
 * server). The local cookie decode is only a fallback for transient network
 * hiccups — never for real auth failures — so it matches the middleware and
 * can't resurrect a stale/revoked session. Fast path: no cookie at all (or an
 * expired one) returns null without a network call.
 */
export async function getSessionUser(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies()
  const fromCookie = decodeSessionUser(cookieStore.getAll())

  let user: { id: string; email?: string | null } | null = null
  let authError: unknown = null
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getUser()
    user = data.user
    authError = error
  } catch (e) {
    user = null
    authError = e
  }

  if (user) return { id: user.id, email: user.email ?? fromCookie?.email ?? "" }

  // Real auth failure (no session, invalid/expired token) → unauthenticated,
  // even if the stale cookie still decodes. Only trust the cookie when the
  // round-trip itself failed transiently.
  if (authError) {
    const msg =
      authError instanceof Error
        ? authError.message
        : typeof authError === "object" && authError !== null && "message" in authError
          ? String((authError as { message?: unknown }).message ?? "")
          : String(authError)
    const extra =
      typeof authError === "object" && authError !== null
        ? `${String((authError as Record<string, unknown>).code ?? "")} ${String(
            (authError as Record<string, unknown>).status ?? "",
          )}`
        : ""
    const transient = /fetch.?failed|failed to fetch|network|econn|etimedout|timeout|load failed|jwk|jwks|clock|429|500|502|503|504/i.test(
      `${msg} ${extra}`,
    )
    if (transient && fromCookie) return fromCookie
  }

  return null
}
