import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function DELETE() {
  const { user, error } = await requireUser()
  if (error) return error

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin client not configured" }, { status: 500 })
  }

  // sequences has no FK to auth.users (only RLS), so delete it explicitly.
  // All other tables (profiles, subscriptions, integrations, clients, invoices,
  // runs, messages, integration_credentials) cascade on user deletion.
  await admin.from("sequences").delete().eq("user_id", user!.id)

  const { error: deleteErr } = await admin.auth.admin.deleteUser(user!.id)
  if (deleteErr) {
    return NextResponse.json({ ok: false, error: deleteErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
