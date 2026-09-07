import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { startRun } from "@/lib/scheduler/dispatch"

export const dynamic = "force-dynamic"

/** PATCH /api/invoices/[id] — mark paid or update status/amount rows */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser()
  if (error) return error

  const body = await request.json()
  const supabase = createClient()

  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .single()
  if (fetchErr || !invoice) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 })

  const patch: Record<string, unknown> = {}

  if (body.mark_paid === true) {
    patch.status = "paid"
    patch.paid_cents = body.paid_cents ?? undefined
    patch.paid_at = new Date().toISOString()
  } else if (body.status) {
    patch.status = body.status
    if (body.status === "paid") patch.paid_at = new Date().toISOString()
  }

  const { error: updErr } = await supabase.from("invoices").update(patch).eq("id", params.id)
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

/** POST /api/invoices/[id]/sequence?sequenceId=… — attach a ladder & start run */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser()
  if (error) return error

  const body = await request.json()
  const sequenceId = String(body.sequenceId ?? "").slice(0, 45)
  if (!sequenceId) return NextResponse.json({ ok: false, error: "sequenceId required" }, { status: 400 })

  const res = await startRun({ userId: user!.id, sequenceId, invoiceId: params.id })
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 })

  return NextResponse.json({ ok: true })
}