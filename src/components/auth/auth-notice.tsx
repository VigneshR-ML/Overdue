"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"

export function AuthNotice() {
  const params = useSearchParams()
  const authError = params.get("auth") === "error"
  const signin = params.get("signin") === "1"
  const reason = params.get("reason")
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const decoded = reason ? decodeURIComponent(reason) : ""
  const isPkce = /pkce|code.verifier/i.test(decoded)

  if (authError && isPkce) {
    return (
      <div role="alert" className="mb-4 rounded-md border border-ember/40 bg-ember/10 p-4 text-[13px] text-ink-soft">
        <p className="font-medium text-ink">Link expired or opened in a different browser.</p>
        <p className="mt-1">
          Confirmation links only work once and must be opened in the same browser you signed up in.
          Please sign in with your email and password to finish verifying your account.
        </p>
        <div className="mt-3 flex gap-2">
          <a href="/login" className="rounded-md bg-moss px-3 py-1.5 text-[12px] font-medium text-white hover:bg-moss-bright">
            Sign in
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-ink"
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  const message = authError
    ? decoded
      ? `Authentication failed: ${decoded}. Please try again.`
      : "Authentication failed. Please try again."
    : signin
      ? "Please sign in to continue."
      : null

  if (!message) return null

  return (
    <div role="alert" className="mb-4 rounded-md border border-ember/40 bg-ember/10 p-3 text-[13px] text-ink-soft flex items-center justify-between gap-3">
      <span>{message}</span>
      <button onClick={() => setDismissed(true)} className="text-faint hover:text-ink cursor-pointer text-[11px] font-mono uppercase tracking-wider" aria-label="Dismiss">
        dismiss
      </button>
    </div>
  )
}
