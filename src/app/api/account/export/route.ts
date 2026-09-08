import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin client not configured" }, { status: 500 })
  }

  const tables = ["profiles", "subscriptions", "clients", "invoices", "sequences", "runs", "messages", "integrations", "integration_credentials"] as const
  const out: Record<string, unknown[]> = {}

  for (const table of tables) {
    const { data } = await admin.from(table).select("*").eq("user_id", user!.id)
    out[table] = data ?? []
  }

  // integration_credentials rows are referenced by user_id; also try by provider.
  return NextResponse.json({ ok: true, exported_at: new Date().toISOString(), user: user!.email, data: out })
}
