import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createPaddleCheckout, isPaddleBillingConfigured } from "@/lib/paddle/server"
import { createCheckout as createDodoCheckout, isBillingConfigured as isDodoBillingConfigured } from "@/lib/dodo/server"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Creates a Paddle hosted checkout for Pro (primary merchant of record) and
 * returns its URL. The session user is bound via custom_data.app_user_id (set
 * on the transaction), so the webhook resolves without relying on email
 * matching. Falls back to Dodo Payments when Paddle isn't configured.
 */
export async function POST(_request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`paddle-checkout:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  if (isPaddleBillingConfigured()) {
    const created = await createPaddleCheckout({ userId: user!.id, email: user!.email ?? undefined })
    if (created) return NextResponse.json({ ok: true, url: created.url, provider: "paddle" })
    // Paddle is configured but the API call failed (see server logs) — fall
    // through to Dodo so the user still gets a working checkout.
    console.error("[billing] Paddle checkout failed, trying Dodo fallback")
  } else {
    console.error("[billing] Paddle not configured, trying Dodo fallback")
  }

  // Fallback: Dodo Payments (kept for existing subscribers / misconfiguration).
  if (isDodoBillingConfigured()) {
    const created = await createDodoCheckout({ userId: user!.id, email: user!.email ?? undefined })
    if (created) return NextResponse.json({ ok: true, url: created.url, provider: "dodo" })
    return NextResponse.json({ ok: false, error: "Couldn't create checkout — try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: false, error: "Billing isn't configured on this deploy yet." }, { status: 503 })
}
