"use client"

import { useCallback, useState } from "react"

/**
 * Dodo Payments checkout for Pro. The hosted checkout URL is created
 * server-side (POST /api/billing/dodo/checkout) so the API key never touches
 * the browser and the user is bound via metadata.app_user_id.
 */
export function useDodoCheckout(props: { email?: string; userId?: string }) {
  const [ready] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const openCheckout = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/billing/dodo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setError(json.error || "Checkout isn't configured yet. Try again later.")
        return
      }
      // Persist identity for the billing-page reconcile in case the redirect
      // races the webhook.
      try {
        localStorage.setItem("overdue:dodo_checkout", "1")
      } catch {}
      window.location.href = json.url
    } catch (e) {
      console.error("[dodo] checkout failed:", e)
      setError("Failed to open checkout. Reload and try again.")
    }
  }, [])

  void props
  return { ready, error, openCheckout }
}