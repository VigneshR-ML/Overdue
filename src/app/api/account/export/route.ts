import { NextResponse } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit"

export const dynamic = "force-dynamic"

export async function GET() {
  const { user, error } = await requireUser()
  if (error) return error

  const rl = rateLimit(`export:${user!.id}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded. Try again later." }, { status: 429 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ ok: false, error: "admin client not configured" }, { status: 500 })
  }

  const PAGE = 1000
  // (D17) profiles references auth.users by its PRIMARY KEY (id), not by a
  // user_id column — query it by id. All other tables are keyed by user_id.
  const tables = ["subscriptions", "clients", "invoices", "sequences", "runs", "messages", "integrations",
    // Settlement + reply intelligence data (was missing entirely).
    "settlement_offers", "settlement_events", "reply_intel", "disputes", "payment_plan_requests"] as const
  const out: Record<string, unknown[]> = {}

  for (const table of tables) {
    const rows: unknown[] = []
    for (let page = 0; ; page++) {
      const from = page * PAGE
      const to = from + PAGE - 1
      const { data, error } = await admin
        .from(table)
        .select("*")
        .eq("user_id", user!.id)
        .range(from, to)
        .order("id", { ascending: true })
      if (error) {
        return NextResponse.json({ ok: false, error: `export failed on ${table}: ${error.message}` }, { status: 500 })
      }
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE) break
    }
    out[table] = rows
  }

  // profiles: filtered on its primary key (id), not user_id.
  const profileRows: unknown[] = []
  for (let page = 0; ; page++) {
    const from = page * PAGE
    const to = from + PAGE - 1
    const { data, error } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user!.id)
      .range(from, to)
      .order("id", { ascending: true })
    if (error) {
      return NextResponse.json({ ok: false, error: `export failed on profiles: ${error.message}` }, { status: 500 })
    }
    profileRows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  out["profiles"] = profileRows

  // integration_credentials: export structure but strip secrets (paginated too)
  const credRows: unknown[] = []
  for (let page = 0; ; page++) {
    const from = page * PAGE
    const to = from + PAGE - 1
    const { data, error } = await admin
      .from("integration_credentials")
      .select("id, user_id, provider, updated_at")
      .eq("user_id", user!.id)
      .range(from, to)
      .order("id", { ascending: true })
    if (error) {
      return NextResponse.json({ ok: false, error: `export failed on integration_credentials: ${error.message}` }, { status: 500 })
    }
    credRows.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  out["integration_credentials"] = credRows

  return NextResponse.json({ ok: true, exported_at: new Date().toISOString(), user: user!.email, data: out })
}
