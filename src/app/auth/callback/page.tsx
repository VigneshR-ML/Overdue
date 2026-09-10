"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Dedicated auth callback page for Google OAuth and email confirmation links.
 *
 * This runs client-side because Google OAuth comes back as a PKCE `?code=`
 * whose verifier lives in browser storage (invisible to a server handler) or as
 * an implicit session in the URL `#` fragment (never sent to the server). The
 * Supabase browser client handles both here; once a session exists we drop the
 * user into onboarding (or `next`).
 *
 * If a callback ever lands anywhere else (e.g. the site root) instead of this
 * page — typically because the redirect URL isn't allowlisted — the global
 * `AuthCodeHandler` in the root layout picks it up with the same logic.
 */
export default function AuthCallback() {
  const [status, setStatus] = useState("Finishing sign-in…")
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const supabase = createClient()
    const { searchParams } = new URL(window.location.href)
    const base = window.location.origin
    const toError = (reason?: string) => {
      const q = reason ? `&reason=${encodeURIComponent(reason)}` : ""
      window.location.replace(`${base}/?auth=error${q}`)
    }

    async function finish() {
      const authError = searchParams.get("error")
      if (authError) {
        toError(authError)
        return
      }

      const code = searchParams.get("code")
      const tokenHash = searchParams.get("token_hash")
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          toError(error.message)
          return
        }
      } else if (tokenHash) {
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
      }

      // Let the browser client recover an implicit-hash session, then confirm.
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        toError()
        return
      }

      // Validate `next` is a safe internal path to prevent open redirects.
      const rawNext = searchParams.get("next")
      let next = "/onboarding"
      if (rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")) {
        next = rawNext
      }

      window.location.replace(`${base}${next}`)
    }

    finish()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <p className="font-mono text-[13px] uppercase tracking-[0.14em] text-muted">{status}</p>
    </div>
  )
}