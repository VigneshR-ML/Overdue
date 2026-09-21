"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"

export function AuthNotice() {
  const params = useSearchParams()
  const authError = params.get("auth") === "error"
  const signin = params.get("signin") === "1"
  // useSearchParams already decodes the value — do NOT decode again here.
  const reason = params.get("reason")
  const source = params.get("source")
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const isPkce = /pkce|code.verifier/i.test(reason ?? "")

  if (authError && isPkce) {
    return (
      <div role="alert" className="mb-4 rounded-md border border-ember/40 bg-ember/10 p-4 text-[13px] text-ink-soft">
        <p className="font-medium text-ink">
          {source === "google" ? "Google sign-in could not finish." : "Link expired or opened in a different browser."}
        </p>
        <p className="mt-1">
          {source === "google"
            ? "Return to sign in and try Google again. Keep this tab open until you arrive at your dashboard."
            : "Confirmation links only work once and must be opened in the same browser you signed up in. Please sign in with your email and password to finish verifying your account."}
        </p>
        <div className="mt-3 flex gap-2">
          <a href="/login" className="rounded-md bg-moss px-3 py-1.5 text-[12px] font-medium text-white hover:bg-moss-bright">
            {source === "google" ? "Try Google again" : "Sign in"}
          </a>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-md border border-hairline px-3 py-1.5 text-[12px] text-muted hover:text-ink cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  const message = authError
    ? reason
      ? `Authentication failed: ${reason}. Please try again.`
      : "Authentication failed. Please try again."
    : signin
      ? "Please sign in to continue."
      : null

  if (!message) return null

  return (
    <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-md border border-ember/40 bg-ember/10 p-3 text-[13px] text-ink-soft">
      <span>{message}</span>
      <div className="flex shrink-0 items-center gap-2">
        {signin ? (
          <a
            href="/login"
            className="rounded-md bg-moss px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-moss-bright"
          >
            Sign in
          </a>
        ) : null}
        <button onClick={() => setDismissed(true)} className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-faint hover:text-ink" aria-label="Dismiss">
          dismiss
        </button>
      </div>
    </div>
  )
}