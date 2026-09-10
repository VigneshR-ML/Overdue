import { NextResponse, type NextRequest } from "next/server"
import { requireUser } from "@/lib/auth/require-user"
import { createClient } from "@/lib/supabase/server"
import { startRun } from "@/lib/scheduler/dispatch"

export const dynamic = "force-dynamic"

/** PATCH /api/invoices/[id] — mark paid or update status/amount rows */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser()
  if (error) return error

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const supabase = createClient()

  const { data: invoice, error: fetchErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user!.id)
    .single()
  if (fetchErr || !invoice) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 })

  const patch: Record<string, unknown> = {}
  const VALID_STATUSES = ["pending", "sent", "overdue", "paid", "partially_paid"]

  if (body.payment_url !== undefined) {
    const rawPay = String(body.payment_url ?? "").trim().slice(0, 500)
    patch.payment_url = rawPay && /^https?:\/\//i.test(rawPay) ? rawPay : null
  }

  // Manual pause/resume of follow-ups: flips queued runs for this invoice.
  // Paused runs keep their schedule; resume re-queues them (overdue ones fire
  // on the next dispatch). Returns counts so the UI can confirm.
  if (body.pause_runs === true || body.resume_runs === true) {
    const to = body.pause_runs === true ? "paused" : "queued"
    const from = body.pause_runs === true ? "queued" : "paused"
    const { data: flipped } = await supabase
      .from("runs")
      .update({ status: to, updated_at: new Date().toISOString() })
      .eq("invoice_id", params.id)
      .eq("user_id", user!.id)
      .eq("status", from)
      .select("id")
    return NextResponse.json({ ok: true, runs: Array.isArray(flipped) ? flipped.length : 0 })
  }

  if (body.mark_paid === true) {
    patch.status = "paid"
    const paidCents = body.paid_cents !== undefined ? Number(body.paid_cents) : undefined
    patch.paid_cents = typeof paidCents === "number" && Number.isFinite(paidCents) && paidCents >= 0 ? paidCents : undefined
    patch.paid_at = new Date().toISOString()
  } else if (body.status) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json({ ok: false, error: `invalid status — must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 })
    }
    patch.status = body.status
    if (body.status === "paid") patch.paid_at = new Date().toISOString()
  }

  const { error: updErr } = await supabase
    .from("invoices")
    .update(patch)
    .eq("id", params.id)
    .eq("user_id", user!.id)
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}

/** POST /api/invoices/[id]/sequence?sequenceId=… — attach a ladder & start run */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireUser()
  if (error) return error

  let postBody: any
  try { postBody = await request.json() } catch { return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 }) }
  const sequenceId = String(postBody.sequenceId ?? "").slice(0, 45)
  if (!sequenceId) return NextResponse.json({ ok: false, error: "sequenceId required" }, { status: 400 })

  const res = await startRun({ userId: user!.id, sequenceId, invoiceId: params.id })
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 400 })

  return NextResponse.json({ ok: true })
}