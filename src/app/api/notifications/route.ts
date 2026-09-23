import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error
  let body: { ids?: unknown; all?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  let query = supabase.from("owner_notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user!.id).is("read_at", null)
  if (body.all !== true) {
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 50) : []
    if (!ids.length) return NextResponse.json({ ok: false, error: "notification ids required" }, { status: 400 })
    query = query.in("id", ids)
  }
  const { error: updateError } = await query
  if (updateError) return NextResponse.json({ ok: false, error: "couldn't update notifications" }, { status: 503 })
  return NextResponse.json({ ok: true })
}
