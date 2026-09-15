import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { CookieOptions } from "@supabase/ssr"
import { decodeSessionUser } from "@/lib/auth/local-session"

/**
 * True only for transient network/server hiccups where `getUser()` couldn't
 * reach Supabase — NOT for real auth failures (missing/invalid/expired
 * session). Only in the transient case do we trust the local cookie decode
 * as a fallback, so a revoked or expired session never looks signed in.
 */
function isTransientAuthError(err: unknown): boolean {
  if (!err) return false
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
        ? String((err as { message?: unknown }).message ?? "")
        : String(err)
  const extra =
    typeof err === "object" && err !== null
      ? `${String((err as Record<string, unknown>).code ?? "")} ${String(
          (err as Record<string, unknown>).status ?? "",
        )} ${String((err as Record<string, unknown>).name ?? "")}`
      : ""
  return /fetch.?failed|failed to fetch|network|econn|etimedout|timeout|load failed|jwk|jwks|clock|429|500|502|503|504/i.test(
    `${msg} ${extra}`,
  )
}

/**
 * Copy refreshed/cleared session cookies from the Supabase response onto a
 * redirect response. Without this, a token refresh (or a sign-out clearing)
 * that happens inside `getUser()` is silently dropped whenever we redirect —
 * the browser keeps the old cookie and the next request disagrees about auth
 * state (`/login` → `/dashboard` → `/?signin=1` loop).
 */
function redirectWithCookies(
  request: NextRequest,
  supabaseResponse: NextResponse,
  mutateUrl: (url: URL) => void,
  status = 307,
) {
  const url = request.nextUrl.clone()
  mutateUrl(url)
  const redirect = NextResponse.redirect(url, { status })
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirect.cookies.set(cookie.name, cookie.value, {
      ...cookie,
    } as CookieOptions & { name?: string; value?: string })
  }
  return redirect
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return supabaseResponse

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        )
      },
    },
  })

  // Validate the session against the auth server (also refreshes the cookie).
  // `getUser()` is the source of truth — the local JWT decode is only a
  // fallback for transient network hiccups, never for real auth failures, so
  // a stale/revoked/expired cookie can't fake a signed-in state.
  let user = null
  let authError: unknown = null
  try {
    const { data, error } = await supabase.auth.getUser()
    user = data.user
    authError = error
  } catch (e) {
    user = null
    authError = e
  }

  const hasCookieSession = decodeSessionUser(request.cookies.getAll()) !== null
  const isAuthed =
    Boolean(user) ||
    (Boolean(authError) && isTransientAuthError(authError) && hasCookieSession)
  const path = request.nextUrl.pathname
  const isAppRoute = path.startsWith("/dashboard") || path.startsWith("/invoices") || path.startsWith("/clients") || path.startsWith("/sequences") || path.startsWith("/insights") || path.startsWith("/settings") || path.startsWith("/tools") || path.startsWith("/onboarding")
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup")
  const isOnboarding = path.startsWith("/onboarding")

  if (isAppRoute && !isAuthed) {
    return redirectWithCookies(request, supabaseResponse, (url) => {
      url.pathname = "/"
      url.searchParams.set("signin", "1")
    })
  }

  if (isAuthPage && isAuthed && !isOnboarding) {
    return redirectWithCookies(request, supabaseResponse, (url) => {
      url.pathname = "/dashboard"
      url.searchParams.delete("signin")
    })
  }

  return supabaseResponse
}