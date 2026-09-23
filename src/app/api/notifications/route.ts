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

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string").slice(0, 50)
    : []
  if (body.all !== true && ids.length === 0) {
    return NextResponse.json({ ok: false, error: "notification ids required" }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data: member } = await supabase
    .from("workspace_members")
    .select("id")
    .eq("user_id", user!.id)
    .eq("role", "owner")
    .order("created_at")
    .limit(1)
    .maybeSingle()

  if (member?.id) {
    let q = supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("recipient_member_id", member.id)
      .is("read_at", null)
    if (body.all !== true) q = q.in("id", ids)
    const { error: notificationError } = await q
    if (notificationError) return NextResponse.json({ ok: false, error: "couldn't update notifications" }, { status: 503 })
  }

  // Compatibility for notifications created before the workspace migration.
  let legacy = supabase
    .from("owner_notifications")
    .update({ read_at: now })
    .eq("user_id", user!.id)
    .is("read_at", null)
  if (body.all !== true) legacy = legacy.in("id", ids)
  const { error: legacyError } = await legacy
  if (legacyError) return NextResponse.json({ ok: false, error: "couldn't update notifications" }, { status: 503 })
  return NextResponse.json({ ok: true })
}
