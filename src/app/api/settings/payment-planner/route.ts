import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireUser()
  if (error) return error
  let body: { enabled?: unknown; maxIncentiveBps?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  if (typeof body.enabled !== "boolean" || typeof body.maxIncentiveBps !== "number" || !Number.isFinite(body.maxIncentiveBps)) {
    return NextResponse.json({ ok: false, error: "enabled and a valid incentive percentage are required" }, { status: 400 })
  }
  const maxIncentiveBps = Math.round(body.maxIncentiveBps)
  if (maxIncentiveBps < 0 || maxIncentiveBps > 2000) return NextResponse.json({ ok: false, error: "incentive must be between 0% and 20%" }, { status: 400 })
  const supabase = createAdminClient()
  if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const { error: saveError } = await supabase.from("payment_plan_automation_settings").upsert({ user_id: user!.id, enabled: body.enabled, max_incentive_bps: maxIncentiveBps, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (saveError) return NextResponse.json({ ok: false, error: "couldn't save auto-plan settings" }, { status: 503 })
  return NextResponse.json({ ok: true })
}
