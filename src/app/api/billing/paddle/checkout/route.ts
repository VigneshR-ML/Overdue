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
 * matching. Dodo is used only when DODO_FALLBACK_ENABLED=true.
 */
export async function POST(_request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`paddle-checkout:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const dodoFallbackEnabled = process.env.DODO_FALLBACK_ENABLED === "true"
  if (isPaddleBillingConfigured()) {
    const created = await createPaddleCheckout({ userId: user!.id, email: user!.email ?? undefined })
    // transactionId lets the client open the Paddle.js overlay directly;
    // url (our page + ?_ptxn=) is the fallback landing that auto-opens it.
    if (created) {
      return NextResponse.json({ ok: true, url: created.url, transactionId: created.transactionId ?? null, provider: "paddle" })
    }
    console.error("[billing] Paddle checkout failed")
    if (!dodoFallbackEnabled) {
      return NextResponse.json({ ok: false, error: "Checkout is temporarily unavailable. Please try again." }, { status: 502 })
    }
  } else {
    console.error("[billing] Paddle is not configured")
    if (!dodoFallbackEnabled) {
      return NextResponse.json({ ok: false, error: "Billing isn't configured on this deploy yet." }, { status: 503 })
    }
  }

  // Explicit fallback only. Legacy Dodo webhooks remain supported regardless,
  // but new Dodo checkouts cannot be created accidentally.
  if (isDodoBillingConfigured()) {
    const created = await createDodoCheckout({ userId: user!.id, email: user!.email ?? undefined })
    if (created) return NextResponse.json({ ok: true, url: created.url, provider: "dodo" })
    return NextResponse.json({ ok: false, error: "Couldn't create checkout — try again." }, { status: 500 })
  }

  return NextResponse.json({ ok: false, error: "Billing isn't configured on this deploy yet." }, { status: 503 })
}
