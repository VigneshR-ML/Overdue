"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Wordmark } from "@/components/marketing/site"

/**
 * Shared error boundary UI for route-level error.tsx files. Renders a calm,
 * on-brand fallback with a page-reload action. Must remain a client component.
 */
export function ErrorLedger({
  error,
  reset,
  minimal = false,
}: {
  error: Error & { digest?: string }
  reset: () => void
  minimal?: boolean
}) {
  const lastErrorRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    const digest = error.digest ?? error.message
    if (lastErrorRef.current === digest) return
    lastErrorRef.current = digest
    console.error("[overdue] error boundary caught:", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 text-center">
      {!minimal && <Wordmark />}
      <h1 className="mt-6 font-display text-6xl tracking-tight text-ink">Ledger hiccup</h1>
      <p className="mt-2 max-w-sm font-mono text-[13px] leading-relaxed text-muted">
        Something went wrong while rendering this page. Your data is safe — hit the button
        below to try again.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}