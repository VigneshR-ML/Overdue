import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { getOwnedRecord } from "@/lib/supabase/ownership"

export const dynamic = "force-dynamic"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser(); if (error) return error
  const { id } = await params
  let body: { status?: unknown }; try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const status = body.status === "accepted" || body.status === "declined" ? body.status : null
  if (!status) return NextResponse.json({ ok: false, error: "status must be accepted or declined" }, { status: 400 })
  const supabase = createAdminClient(); if (!supabase) return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 500 })
  const owned = await getOwnedRecord<{ invoice_id: string; status: string }>(supabase, "payment_plan_requests", id, user!.id, "invoice_id, status")
  if (!owned.ok) return NextResponse.json({ ok: false, error: "payment plan not found" }, { status: 404 })
  if (owned.record.status !== "open") return NextResponse.json({ ok: false, error: "payment plan was already handled" }, { status: 409 })
  const { error: updateError } = await supabase.from("payment_plan_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user!.id).eq("status", "open")
  if (updateError) return NextResponse.json({ ok: false, error: "couldn't update payment plan" }, { status: 503 })
  if (status === "declined") await supabase.from("runs").update({ status: "queued", automation_confidence: null, error: null, updated_at: new Date().toISOString() }).eq("user_id", user!.id).eq("invoice_id", owned.record.invoice_id).eq("status", "paused")
  return NextResponse.json({ ok: true })
}
