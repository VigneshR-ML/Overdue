"use client"

import { useEffect, useState } from "react"

/**
 * Renders the localized Pro price using Paddle's PricePreview, so buyers see
 * their own currency without any conversion math on our side (Paddle detects
 * the country and returns the formatted total). Falls back to the default
 * "$19" while Paddle loads or when it isn't configured.
 */
export function ProPrice({ className }: { className?: string }) {
  const [price, setPrice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const vendorId = process.env.NEXT_PUBLIC_PADDLE_VENDOR_ID
    const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_PRO_MONTHLY
    if (!vendorId || !priceId || !/^pri_/.test(priceId)) return

    ;(async () => {
      try {
        const { initializePaddle } = await import("@paddle/paddle-js")
        const paddle = await initializePaddle({
          token: vendorId,
          environment:
            process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "live" ? "production" : "sandbox",
        })
        if (!paddle?.PricePreview) return
        const preview = await paddle.PricePreview({
          items: [{ priceId, quantity: 1 }],
        })
        if (cancelled) return
        const line = preview?.data?.details?.lineItems?.[0]
        const total = line?.formattedTotals?.total
        if (typeof total === "string" && total) setPrice(total)
      } catch (e) {
        console.error("[paddle] price preview failed:", e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return <span className={className}>{price ?? "$19"}</span>
}