import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { attachPaddleCustomer } from "@/lib/billing/reconcile"

export const dynamic = "force-dynamic"

// Trivial per-user rate limit: at most one attach attempt per 10s. In-memory,
// so it only throttles per instance — enough to stop accidental/replay loops
// while staying dependency-free.
const attempts = new Map<string, number>()
const ATTACH_WINDOW_MS = 10_000

/**
 * Called by the browser right after Paddle fires `checkout.completed`.
 * The session user asserts "this Paddle customer was MY checkout", so we bind
 * the paddle_customer_id to their row and reconcile immediately — the user
 * becomes Pro the moment they land back in the app, no webhook needed.
 */
export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireUser()
  if (authError) return authError

  const now = Date.now()
  const last = attempts.get(user!.id) ?? 0
  if (now - last < ATTACH_WINDOW_MS) {
    return NextResponse.json({ ok: false, error: "too many attempts" }, { status: 429 })
  }
  attempts.set(user!.id, now)

  let body: { customerId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const customerId = typeof body?.customerId === "string" ? body.customerId : null
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "customerId required" }, { status: 400 })
  }

  // Ownership check: only bind when the Paddle customer's email matches the
  // session user's verified email, so a user can't claim someone else's id.
  const result = await attachPaddleCustomer(user!.id, customerId, user!.email ?? "")
  if (!result.applied) {
    return NextResponse.json({ ok: false, error: "customer could not be verified" }, { status: 403 })
  }
  return NextResponse.json({ ok: true, applied: true, subscriptionId: result.subscriptionId })
}