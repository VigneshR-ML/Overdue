"use client"

import { useCallback, useState } from "react"

/**
 * Paddle checkout for Pro (primary merchant of record). The hosted checkout
 * URL is created server-side (POST /api/billing/paddle/checkout) so the API
 * key never touches the browser and the user is bound via
 * custom_data.app_user_id.
 */
export function usePaddleCheckout() {
  const [ready] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const openCheckout = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/billing/paddle/checkout", {
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
        localStorage.setItem("overdue:paddle_checkout", "1")
      } catch {}
      window.location.href = json.url
    } catch (e) {
      console.error("[paddle] checkout failed:", e)
      setError("Failed to open checkout. Reload and try again.")
    }
  }, [])

  return { ready, error, openCheckout }
}
