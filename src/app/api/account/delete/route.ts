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
