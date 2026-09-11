import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { attachPaddleCustomer } from "@/lib/billing/reconcile"

export const dynamic = "force-dynamic"

/**
 * Called by the browser right after Paddle fires `checkout.completed`.
 * The session user asserts "this Paddle customer was MY checkout", so we bind
 * the paddle_customer_id to their row and reconcile immediately — the user
 * becomes Pro the moment they land back in the app, no webhook needed.
 */
export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireUser()
  if (authError) return authError

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

  const result = await attachPaddleCustomer(user!.id, customerId)
  return NextResponse.json({ ok: true, ...result })
}