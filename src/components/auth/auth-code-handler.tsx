"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Global auth-callback safety net. When OAuth/email links come back with
 * `?code=` or `?token_hash=` on a page that isn't `/auth/callback` (Supabase
 * drops them onto the Site URL — typically `/` — when the redirectTo URL isn't
 * in the Auth → URL Configuration allowlist), this completes the exchange and
 * routes into onboarding. The code verifier is in browser storage, so the
 * client-side exchange works no matter where the link lands.
 */
export function AuthCodeHandler() {
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const { searchParams, pathname } = new URL(window.location.href)
    const code = searchParams.get("code")
    const tokenHash = searchParams.get("token_hash")
    const authError = searchParams.get("error")

    if (!code && !tokenHash && !authError) return
    // The dedicated callback page handles its own path — don't double-exchange.
    if (pathname.startsWith("/auth/callback")) return

    const supabase = createClient()
    const base = window.location.origin
    const toError = (reason?: string) => {
      const q = reason ? `&reason=${encodeURIComponent(reason)}` : ""
      window.location.replace(`${base}/?auth=error${q}`)
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
            toError(error.message)
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
      window.location.assign(`${base}${next}`)
    }

    finish()
  }, [])

  return null
}