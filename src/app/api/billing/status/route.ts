import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { getPaddleClient } from "@/lib/paddle/server"
import { paddleEnvironment, paddlePriceId, isPaddleBillingConfigured } from "@/lib/paddle/helpers"
import { isBillingConfigured as isDodoBillingConfigured } from "@/lib/dodo/server"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Billing diagnostics for the account owner (auth required, never exposes
 * secrets). Returns which providers are configured and whether Paddle is
 * actually reachable with the deployed key — so a "Dodo fallback" surprise
 * can be pinpointed without dashboard access:
 *   - paddle.configured=false  → PADDLE_* env vars missing in this deploy
 *   - paddle.reachable=false   → key wrong scope/environment or price bad
 */
export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`billing-status:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const paddleConfigured = isPaddleBillingConfigured()
  let paddleReachable: boolean | null = null
  let paddlePriceStatus: string | null = null
  if (paddleConfigured) {
    try {
      const client = getPaddleClient()
      const price = await client!.prices.get(paddlePriceId()!)
      paddleReachable = true
      paddlePriceStatus = String((price as { status?: unknown })?.status ?? "unknown")
    } catch (e) {
      paddleReachable = false
      paddlePriceStatus = null
      console.error("[billing] status check: Paddle reachable=false:", e instanceof Error ? e.message.slice(0, 300) : "unknown")
    }
  }

  return NextResponse.json({
    ok: true,
    paddle: {
      configured: paddleConfigured,
      environment: paddleEnvironment(),
      priceSet: Boolean(paddlePriceId()),
      reachable: paddleReachable,
      priceStatus: paddlePriceStatus,
    },
    dodo: {
      configured: isDodoBillingConfigured(),
    },
  })
}
