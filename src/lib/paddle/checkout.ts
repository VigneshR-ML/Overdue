"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/**
 * Loads the Paddle JS SDK lazily and opens the checkout overlay for Pro.
 * Falls back gracefully when Paddle isn't configured (env vars missing).
 */
export function usePaddleCheckout(props: { email?: string; userId?: string }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const paddleRef = useRef<any>(null)

  useEffect(() => {
    const vendorId = process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID
    const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY
    if (!vendorId || !priceId) {
      setError("Paddle isn't configured on this deploy yet. Add NEXT_PUBLIC_PADDLE_VENDOR_ID and NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY.")
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { initializePaddle } = await import("@paddle/paddle-js")
        const paddle = await initializePaddle({
          token: vendorId!,
          environment: process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "live" ? "production" : "sandbox",
          eventCallback: (event: any) => {
            // Paddle fires 'checkout.completed'; the webhook does the real sync.
            if (event?.name === "checkout.completed") {
              window.dispatchEvent(new CustomEvent("overdue:paddle-completed"))
            }
          },
        })
        if (cancelled) return
        paddleRef.current = paddle
        setReady(true)
      } catch {
        if (!cancelled) setError("Couldn't load the payment provider.")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openCheckout = useCallback(() => {
    const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY
    if (!priceId) {
      setError("Paddle isn't configured on this deploy yet (no price ID).")
      return
    }
    if (!/^pri_/.test(priceId)) {
      setError(
        "Checkout isn't configured correctly — NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY must be a Paddle price ID (pri_…), not a product ID.",
      )
      return
    }
    if (!paddleRef.current) {
      setError("Checkout hasn't finished loading — try again.")
      return
    }
    paddleRef.current.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      settings: {
        displayMode: "overlay",
        successUrl: `${window.location.origin}/settings?upgraded=1`,
        eventData: { user_id: props.userId ?? "" },
      },
      customer: props.email ? { email: props.email } : undefined,
    })
  }, [props.email, props.userId])

  return { ready, error, openCheckout }
}