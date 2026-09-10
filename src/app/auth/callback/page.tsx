"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Auth callback for Google OAuth, email confirmations, and invites.
 *
 * This must run client-side: Google OAuth can come back either as a PKCE
 * `?code=` (whose verifier lives in the browser's localStorage — invisible to
 * any server route handler) or as an implicit session in the URL `#` fragment
 * (which never reaches the server at all). The Supabase browser client handles
 * both; once a session exists we drop the user into onboarding (or `next`).
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
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
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