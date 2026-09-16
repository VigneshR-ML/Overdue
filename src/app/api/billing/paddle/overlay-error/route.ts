import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

/**
 * Telemetry for Paddle overlay failures. The checkout button falls back to
 * Dodo when Paddle.js can't open the overlay (bad token, blocked CDN, slow
 * script) — without this beacon the exact stage is only in the buyer's
 * browser console. Body carries token *kind* only, never the token itself.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`paddle-overlay-error:${user!.id}`, RATE_LIMITS.api.limit, RATE_LIMITS.api.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      stage?: unknown
      message?: unknown
      tokenKind?: unknown
      env?: unknown
      transactionId?: unknown
    }
    console.error(
      "[paddle] overlay failure:",
      JSON.stringify({
        stage: String(body.stage ?? "unknown").slice(0, 40),
        message: String(body.message ?? "").slice(0, 500),
        tokenKind: String(body.tokenKind ?? "").slice(0, 20),
        env: String(body.env ?? "").slice(0, 20),
        transactionId: String(body.transactionId ?? "").slice(0, 40),
        userId: user!.id,
      }),
    )
  } catch {
    // Telemetry must never fail the request.
  }

  return NextResponse.json({ ok: true })
}
