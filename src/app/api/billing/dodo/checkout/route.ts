import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createCheckout, isBillingConfigured } from "@/lib/dodo/server"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Creates a Dodo Payments hosted checkout for Pro and returns its URL. The
 * session user is bound via metadata.app_user_id (set on the checkout), so the
 * webhook resolves without relying on email matching.
 */
export async function POST() {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = await rateLimit(`dodo-checkout:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  if (!isBillingConfigured()) {
    return NextResponse.json({ ok: false, error: "Billing isn't configured on this deploy yet." }, { status: 503 })
  }

  const created = await createCheckout({ userId: user!.id, email: user!.email ?? undefined })
  if (created) return NextResponse.json({ ok: true, url: created.url })

  return NextResponse.json({ ok: false, error: "Couldn't create checkout — try again." }, { status: 500 })
}