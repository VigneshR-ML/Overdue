import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error

  // Rate limit account deletion
  const rl = rateLimit(`account-delete:${user!.id}`, RATE_LIMITS.accountDelete.limit, RATE_LIMITS.accountDelete.windowMs)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Too many deletion attempts. Try again later." }, { status: 429 })
  }

  // Require confirmation token to prevent accidental/CSRF deletion
  const body = await request.json().catch(() => ({}))
  const confirmationToken = body?.confirmation_token
  if (confirmationToken !== "DELETE_MY_ACCOUNT") {
    return NextResponse.json(
      { ok: false, error: 'Pass {"confirmation_token":"DELETE_MY_ACCOUNT"} to confirm deletion.' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin client not configured" }, { status: 500 })
  }

  // (D16) Cancel ANY live billing subscription (Paddle AND Dodo) BEFORE
  // deleting the auth user, so we never leave ghost charges behind. If a
  // subscription exists but the provider is configured and the cancel call
  // fails, deletion is blocked with a clear error — silently deleting an
  // account with a live charge is worse than asking the user to retry.
  try {
    const { data: subscriptions } = await admin
      .from("subscriptions")
      .select("dodo_subscription_id, paddle_subscription_id, plan, status")
      .eq("user_id", user!.id)
    const subs = subscriptions ?? []

    const paddleSubId = subs.find((s) => s.paddle_subscription_id)?.paddle_subscription_id as string | undefined
    if (paddleSubId) {
      const { cancelPaddleSubscription } = await import("@/lib/paddle/server")
      const { isPaddleBillingConfigured } = await import("@/lib/paddle/helpers")
      if (!isPaddleBillingConfigured()) {
        console.warn("[account-delete] paddle sub not cancelled: provider not configured")
      } else if (!(await cancelPaddleSubscription(paddleSubId))) {
        return NextResponse.json(
          { ok: false, error: "Couldn't cancel your Paddle subscription — please try again or contact support." },
          { status: 500 },
        )
      }
    }

    const dodoSubId = subs.find((s) => s.dodo_subscription_id)?.dodo_subscription_id as string | undefined
    if (dodoSubId) {
      const { cancelSubscription } = await import("@/lib/dodo/server")
      const { isBillingConfigured } = await import("@/lib/dodo/helpers")
      if (!isBillingConfigured()) {
        console.warn("[account-delete] dodo sub not cancelled: provider not configured")
      } else if (!(await cancelSubscription(dodoSubId))) {
        return NextResponse.json(
          { ok: false, error: "Couldn't cancel your subscription — please try again or contact support." },
          { status: 500 },
        )
      }
    }
  } catch (e) {
    console.error("[account-delete] billing cancel failed (blocking):", e)
    return NextResponse.json(
      { ok: false, error: "Couldn't cancel your subscription — please try again or contact support." },
      { status: 500 },
    )
  }

  // Delete auth user first — cascades to profiles, clients, invoices, runs,
  // messages, subscriptions, integrations, integration_credentials.
  const { error: deleteErr } = await admin.auth.admin.deleteUser(user!.id)
  if (deleteErr) {
    console.error("[account-delete] failed:", deleteErr.message)
    return NextResponse.json({ ok: false, error: "Couldn't delete account — please retry or contact support." }, { status: 500 })
  }

  // Cleanup sequences separately (no FK to auth.users, only RLS)
  await admin.from("sequences").delete().eq("user_id", user!.id)

  return NextResponse.json({ ok: true })
}
