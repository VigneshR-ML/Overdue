"use client"

/**
 * Renders the Pro price. Kept static (no client-side price-preview SDK),
 * so the price is static ($19/mo) — the hosted checkout shows the localized
 * total with tax before the buyer pays.
 */
export function ProPrice({ className }: { className?: string }) {
  return <span className={className}>$19</span>
}
