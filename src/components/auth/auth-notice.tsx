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

  const message = authError
    ? reason
      ? `Authentication failed: ${decodeURIComponent(reason)}. Please try again.`
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
