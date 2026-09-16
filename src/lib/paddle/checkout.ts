"use client"

import { useCallback, useEffect, useState } from "react"

/**
 * Paddle checkout for Pro (primary merchant of record).
 *
 * Paddle Billing has no standalone hosted page: the payment form opens via
 * the Paddle.js overlay, either directly with a transaction id or via a
 * `?_ptxn=<id>` landing URL on a page that loads Paddle.js. This hook:
 *   1. loads + initializes Paddle.js (client-side token, never the API key),
 *   2. creates the transaction server-side (POST /api/billing/paddle/checkout,
 *      user bound via custom_data.app_user_id),
 *   3. opens the overlay with the returned transaction id,
 *   4. on mount, auto-opens the overlay when the URL carries `?_ptxn=`
 *      (covers the redirect landing path + slow script races).
 *
 * Throws when Paddle.js can't load so callers can fall back to Dodo.
 */

const PADDLE_JS_URL = "https://cdn.paddle.com/paddle/v2/paddle.js"

interface PaddleJs {
  Initialize: (opts: {
    token?: string
    environment?: "sandbox" | "production"
    checkout?: { settings?: Record<string, unknown> }
  }) => void
  Checkout: {
    open: (opts: { transactionId: string; settings?: Record<string, unknown> }) => void
  }
}

declare global {
  interface Window {
    Paddle?: PaddleJs
  }
}

function paddleEnv(): "sandbox" | "production" {
  const v = (process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT || "sandbox").toLowerCase()
  return v === "live" ? "production" : "sandbox"
}

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")
}

let initPromise: Promise<void> | null = null

/** Loads Paddle.js (once per page) and initializes it. Rejects when unavailable. */
function ensurePaddle(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (window.Paddle) return Promise.resolve()
  if (initPromise) return initPromise
  initPromise = new Promise<void>((resolve, reject) => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || ""
    if (!token) {
      reject(new Error("Paddle client token not configured"))
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PADDLE_JS_URL}"]`)
    const onLoad = () => {
      try {
        if (!window.Paddle) throw new Error("Paddle.js failed to initialize")
        window.Paddle.Initialize({ token, environment: paddleEnv() })
        resolve()
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Paddle.js failed to initialize"))
      }
    }
    if (existing) {
      if (window.Paddle) {
        onLoad()
      } else {
        existing.addEventListener("load", onLoad, { once: true })
        existing.addEventListener("error", () => reject(new Error("Paddle.js failed to load")), { once: true })
      }
      return
    }
    const script = document.createElement("script")
    script.src = PADDLE_JS_URL
    script.async = true
    script.onload = onLoad
    script.onerror = () => reject(new Error("Paddle.js failed to load"))
    document.head.appendChild(script)
    // Don't hang forever on a blocked/slow CDN (adblockers love this URL).
    setTimeout(() => reject(new Error("Paddle.js load timed out")), 15000)
  })
  // Allow retry on next call after a failure.
  initPromise.catch(() => {
    initPromise = null
  })
  return initPromise
}

/** Opens the overlay for a transaction. Rejects when Paddle.js is unavailable. */
async function openTransaction(transactionId: string): Promise<void> {
  await ensurePaddle()
  const base = appBaseUrl()
  window.Paddle!.Checkout.open({
    transactionId,
    settings: {
      displayMode: "overlay",
      ...(base ? { successUrl: `${base}/settings/billing?upgraded=1` } : {}),
    },
  })
}

export function usePaddleCheckout() {
  const [ready] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Landing path: server redirects to our billing URL with ?_ptxn=<id> (its
  // checkout.url). Open the overlay for it once Paddle.js is ready. Mount-only
  // so cancelling the overlay doesn't loop.
  useEffect(() => {
    let cancelled = false
    try {
      const txn = new URLSearchParams(window.location.search).get("_ptxn")
      if (!txn) return
      openTransaction(txn).catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't open checkout.")
      })
    } catch {
      // No window (SSR) — nothing to do.
    }
    return () => {
      cancelled = true
    }
  }, [])

  const openCheckout = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch("/api/billing/paddle/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const json = (await res.json().catch(() => ({}))) as {
        url?: string
        transactionId?: string | null
        error?: string
        provider?: string
      }
      if (!res.ok || (!json.url && !json.transactionId)) {
        const msg = json.error || "Checkout isn't configured yet. Try again later."
        setError(msg)
        throw new Error(msg)
      }
      if (json.provider) console.info("[billing] redirecting via", json.provider)
      // Dodo hosts its own page — plain redirect. Paddle needs the overlay.
      if (json.provider === "dodo" || !json.transactionId) {
        if (!json.url) throw new Error("Checkout isn't configured yet. Try again later.")
        try {
          localStorage.setItem("overdue:dodo_checkout", "1")
        } catch {}
        window.location.href = json.url
        return
      }
      try {
        localStorage.setItem("overdue:paddle_checkout", "1")
      } catch {}
      // Overlay failed (Paddle.js blocked or no client token): throw so the
      // caller falls back to Dodo's hosted page, which needs no client JS.
      await openTransaction(json.transactionId)
    } catch (e) {
      console.error("[paddle] checkout failed:", e)
      if (e instanceof Error && /Paddle\.js|client token|timed out/i.test(e.message)) {
        const msg = "Couldn't load the Paddle checkout. Trying the backup…"
        setError(msg)
        throw new Error(msg)
      }
      if (e instanceof Error) throw e
      const msg = "Failed to open checkout. Reload and try again."
      setError(msg)
      throw new Error(msg)
    }
  }, [])

  return { ready, error, openCheckout }
}
