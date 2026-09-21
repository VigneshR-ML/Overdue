"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Global auth-callback safety net + stale-session self-healer.
 *
 * 1. When OAuth/email links come back with `?code=` or `?token_hash=` on a
 *    page that isn't `/auth/callback` (Supabase drops them onto the Site URL
 *    — typically `/` — when the redirectTo URL isn't in the Auth → URL
 *    Configuration allowlist), this completes the exchange and routes into
 *    onboarding.
 * 2. When landing on `/` or `/login` with NO auth params but a leftover
 *    `sb-*-auth-token` cookie and no real session (expired/revoked/cleared
 *    elsewhere), it clears the stale cookies locally. Without this, middleware
 *    could once have read the stale cookie as "signed in" and bounced
 *    `/login` → `/dashboard` → `/?signin=1`.
 */
export function AuthCodeHandler() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    // Public pages must still render on a fresh clone or an unconfigured
    // preview deployment. AuthForm shows the actionable setup message when a
    // visitor actually attempts to sign in.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return

    const { searchParams, pathname } = new URL(window.location.href)
    const code = searchParams.get("code")
    const tokenHash = searchParams.get("token_hash")
    const authError = searchParams.get("error")

    const supabase = createClient()

    // Self-heal stale cookies when there's no callback to handle.
    if (!code && !tokenHash && !authError) {
      // Only run where a stale "looks signed in" cookie causes harm.
      if (pathname !== "/" && pathname !== "/login" && pathname !== "/signup") return
      const hasStaleCookie = document.cookie
        .split(";")
        .some((c) => /sb-.+-auth-token/.test(c.trim()))
      if (!hasStaleCookie) return
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          // Local-only clear: drops the dead cookies without touching a
          // (nonexistent) server session, so the next click on Sign in
          // correctly stays on /login instead of bouncing via /dashboard.
          supabase.auth.signOut({ scope: "local" }).catch(() => {})
        }
      })
      return
    }
    // The dedicated callback page handles its own path — don't double-exchange.
    if (pathname.startsWith("/auth/callback")) return
    // Only act when Supabase dropped the callback onto the Site URL (the root).
    // Running on /login, /signup or app pages would yank users out mid-flow.
    if (pathname !== "/") return

    const base = window.location.origin
    const toError = (reason?: string) => {
      const params = new URLSearchParams({ auth: "error" })
      if (reason) params.set("reason", reason)
      if (searchParams.get("source") === "google") params.set("source", "google")
      window.location.replace(`${base}/?${params.toString()}`)
    }

    async function finish() {
      if (authError) {
        toError(authError)
        return
      }

      try {
        if (tokenHash) {
          const type = searchParams.get("type") ?? "email"
          const valid = ["signup", "email", "recovery", "invite", "magiclink", "email_change"]
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: valid.includes(type) ? (type as "signup") : "email",
          })
          if (error) {
            toError(error.message)
            return
          }
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            const isPkce = /pkce|code.verifier/i.test(error.message)
            toError(isPkce ? "pkce_error" : error.message)
            return
          }
        }
      } catch (e) {
        console.error("[auth-code-handler] exchange failed:", e)
        toError()
        return
      }

      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        toError()
        return
      }

      const rawNext = searchParams.get("next")
      let next = "/onboarding"
      if (rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")) {
        next = rawNext
      }

      // Strip the auth params so the landing page doesn't echo them.
      const clean = new URL(window.location.href)
      for (const k of ["code", "token_hash", "type", "error_description", "error"]) {
        clean.searchParams.delete(k)
      }
      const keepNext = searchParams.get("next")
      if (keepNext) clean.searchParams.set("next", keepNext)
      window.history.replaceState(null, "", clean.toString())
      // A full navigation makes the new auth cookies visible to server components.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`${base}${next}`)
    }

    finish()
  }, [])

  return null
}
